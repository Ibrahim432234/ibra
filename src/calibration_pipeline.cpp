// Copyright (c) 2025
// SPDX-License-Identifier: MIT

#include <opencv2/calib3d.hpp>
#include <opencv2/core.hpp>
#include <opencv2/highgui.hpp>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>

#include <algorithm>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <optional>
#include <string>
#include <tuple>
#include <vector>

namespace fs = std::filesystem;

struct CalibrationConfig {
    cv::Size boardSize{13, 12};          // inner corners (columns, rows)
    float squareSizeMm{50.0F};           // physical edge length of a square
    cv::Size imageSize{1280, 1024};      // expected image size
    bool useInteractiveRoi{false};       // fallback to auto ROI by default
    bool saveIntermediate{true};
    bool enableRationalModel{true};
    bool fixK3{false};
    int maxChessboardIters{1000};
    double cornerRefinementEps{1e-4};
    cv::Size cornerRefinementWindow{11, 11};
};

struct ImageRecord {
    fs::path inputPath;
    cv::Mat original;
    cv::Mat gray;
    std::vector<cv::Point2f> cornersGlobal;
    std::vector<cv::Point2f> cornersRoi;
    cv::Rect roi;
    bool cornersFound{false};
    bool roiCornersFound{false};
    double reprojectionErrorGlobal{std::numeric_limits<double>::quiet_NaN()};
    double reprojectionErrorRoi{std::numeric_limits<double>::quiet_NaN()};
    double detectionTimeMs{0.0};
};

struct CalibrationResult {
    cv::Mat cameraMatrix;
    cv::Mat distCoeffs;
    std::vector<cv::Mat> rvecs;
    std::vector<cv::Mat> tvecs;
    std::vector<double> perViewErrors;
    double rms{0.0};
};

struct MetricResult {
    double meanShiftInside{0.0};
    double meanShiftOutside{0.0};
    size_t samplesInside{0};
    size_t samplesOutside{0};
};

static void ensureDirectory(const fs::path& root) {
    std::error_code ec;
    fs::create_directories(root, ec);
    if (ec) {
        throw std::runtime_error("Failed to create directory: " + root.string() + " (" + ec.message() + ")");
    }
}

static void drawHeader(cv::Mat& image, const std::string& text, const cv::Scalar& color = {0, 255, 0}) {
    int baseline = 0;
    const int font = cv::FONT_HERSHEY_SIMPLEX;
    const double scale = 0.6;
    const int thickness = 2;
    cv::Size textSize = cv::getTextSize(text, font, scale, thickness, &baseline);

    cv::Rect box{10, 10, textSize.width + 20, textSize.height + 15};
    cv::rectangle(image, box, cv::Scalar(0, 0, 0), cv::FILLED);
    cv::rectangle(image, box, color, 1);
    cv::putText(image, text, {box.x + 10, box.y + box.height - 10}, font, scale, color, thickness, cv::LINE_AA);
}

static void saveImage(const fs::path& path, const cv::Mat& image) {
    ensureDirectory(path.parent_path());
    if (!cv::imwrite(path.string(), image)) {
        throw std::runtime_error("Failed to save image: " + path.string());
    }
}

static std::vector<fs::path> collectImages(const fs::path& directory) {
    if (!fs::exists(directory) || !fs::is_directory(directory)) {
        throw std::runtime_error("Input path is not a directory: " + directory.string());
    }

    std::vector<fs::path> images;
    for (const auto& entry : fs::directory_iterator(directory)) {
        if (!entry.is_regular_file()) {
            continue;
        }
        const auto ext = entry.path().extension().string();
        if (ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".bmp" || ext == ".tiff") {
            images.push_back(entry.path());
        }
    }
    std::sort(images.begin(), images.end());
    if (images.empty()) {
        throw std::runtime_error("No images found in directory: " + directory.string());
    }
    return images;
}

static std::optional<std::vector<cv::Point2f>> detectCornersSB(const cv::Mat& gray, const cv::Size& boardSize) {
    std::vector<cv::Point2f> corners;
    auto flags = cv::CALIB_CB_EXHAUSTIVE | cv::CALIB_CB_ACCURACY;
    bool ok = cv::findChessboardCornersSB(gray, boardSize, corners, flags);
    if (!ok) {
        return std::nullopt;
    }
    return corners;
}

static std::optional<std::vector<cv::Point2f>> detectCornersClassic(const cv::Mat& gray, const CalibrationConfig& config) {
    std::vector<cv::Point2f> corners;
    const cv::TermCriteria criteria(cv::TermCriteria::EPS + cv::TermCriteria::COUNT, config.maxChessboardIters, config.cornerRefinementEps);

    bool ok = cv::findChessboardCorners(gray, config.boardSize, corners, cv::CALIB_CB_ADAPTIVE_THRESH | cv::CALIB_CB_NORMALIZE_IMAGE);
    if (!ok) {
        return std::nullopt;
    }
    cv::cornerSubPix(gray, corners, config.cornerRefinementWindow, {-1, -1}, criteria);
    return corners;
}

static std::vector<cv::Point3f> buildObjectPattern(const cv::Size& boardSize, float squareSize) {
    std::vector<cv::Point3f> pattern;
    pattern.reserve(static_cast<size_t>(boardSize.width * boardSize.height));
    for (int y = 0; y < boardSize.height; ++y) {
        for (int x = 0; x < boardSize.width; ++x) {
            pattern.emplace_back(static_cast<float>(x) * squareSize, static_cast<float>(y) * squareSize, 0.0F);
        }
    }
    return pattern;
}

static cv::Rect boundingRectOfCorners(const std::vector<cv::Point2f>& corners) {
    std::vector<cv::Point2f> pts = corners;
    return cv::boundingRect(pts);
}

static cv::Rect expandRect(const cv::Rect& rect, const cv::Size& imageSize, double factor = 1.1) {
    const double cx = rect.x + rect.width / 2.0;
    const double cy = rect.y + rect.height / 2.0;
    const double newWidth = rect.width * factor;
    const double newHeight = rect.height * factor;

    cv::Rect expanded(static_cast<int>(std::round(cx - newWidth / 2.0)), static_cast<int>(std::round(cy - newHeight / 2.0)), static_cast<int>(std::round(newWidth)), static_cast<int>(std::round(newHeight)));
    expanded &= cv::Rect(0, 0, imageSize.width, imageSize.height);
    return expanded;
}

static cv::Rect medianRoi(const std::vector<cv::Rect>& rects, const cv::Size& imageSize) {
    if (rects.empty()) {
        return {0, 0, imageSize.width, imageSize.height};
    }

    std::vector<int> xs, ys, ws, hs;
    xs.reserve(rects.size());
    ys.reserve(rects.size());
    ws.reserve(rects.size());
    hs.reserve(rects.size());
    for (const auto& r : rects) {
        xs.push_back(r.x);
        ys.push_back(r.y);
        ws.push_back(r.width);
        hs.push_back(r.height);
    }
    auto median = [](std::vector<int> values) {
        std::nth_element(values.begin(), values.begin() + values.size() / 2, values.end());
        return values[values.size() / 2];
    };

    cv::Rect roi{median(xs), median(ys), median(ws), median(hs)};
    return expandRect(roi, imageSize, 1.05);
}

static std::vector<cv::Point2f> filterCornersByRoi(const std::vector<cv::Point2f>& corners, const cv::Rect& roi) {
    std::vector<cv::Point2f> subset;
    subset.reserve(corners.size());
    for (const auto& pt : corners) {
        if (roi.contains(pt)) {
            subset.push_back(pt);
        }
    }
    return subset;
}

static std::vector<cv::Point3f> buildObjectSubset(const std::vector<cv::Point2f>& subset, const cv::Size& boardSize, float squareSize, const std::vector<cv::Point2f>& original) {
    std::vector<cv::Point3f> objectSubset;
    objectSubset.reserve(subset.size());

    for (const auto& pt : subset) {
        auto it = std::find(original.begin(), original.end(), pt);
        if (it == original.end()) {
            continue;
        }
        const ptrdiff_t idx = std::distance(original.begin(), it);
        const int col = static_cast<int>(idx % boardSize.width);
        const int row = static_cast<int>(idx / boardSize.width);
        objectSubset.emplace_back(static_cast<float>(col) * squareSize, static_cast<float>(row) * squareSize, 0.0F);
    }
    return objectSubset;
}

static cv::Mat makeRoiMask(const cv::Size& size, const cv::Rect& roi) {
    cv::Mat mask(size, CV_8UC1, cv::Scalar(0));
    cv::rectangle(mask, roi, cv::Scalar(255), cv::FILLED);
    return mask;
}

static CalibrationResult calibrate(const std::vector<std::vector<cv::Point3f>>& objectPoints,
                                   const std::vector<std::vector<cv::Point2f>>& imagePoints,
                                   const CalibrationConfig& config) {
    CalibrationResult result;
    result.cameraMatrix = cv::Mat::eye(3, 3, CV_64F);
    result.distCoeffs = cv::Mat::zeros(config.enableRationalModel ? 8 : 5, 1, CV_64F);

    int flags = cv::CALIB_ZERO_TANGENT_DIST;
    if (config.enableRationalModel) {
        flags |= cv::CALIB_RATIONAL_MODEL;
    }
    if (config.fixK3) {
        flags |= cv::CALIB_FIX_K3;
    }

    result.rms = cv::calibrateCamera(objectPoints, imagePoints, config.imageSize,
                                     result.cameraMatrix, result.distCoeffs,
                                     result.rvecs, result.tvecs, flags);

    result.perViewErrors.resize(objectPoints.size());
    for (size_t i = 0; i < objectPoints.size(); ++i) {
        std::vector<cv::Point2f> projected;
        cv::projectPoints(objectPoints[i], result.rvecs[i], result.tvecs[i], result.cameraMatrix, result.distCoeffs, projected);
        double err = 0.0;
        for (size_t j = 0; j < projected.size(); ++j) {
            err += cv::norm(projected[j] - imagePoints[i][j]);
        }
        result.perViewErrors[i] = projected.empty() ? 0.0 : err / static_cast<double>(projected.size());
    }

    return result;
}

static cv::Mat undistortWithMaps(const cv::Mat& image, const CalibrationResult& calibResult, const cv::Size& size, cv::Mat& map1, cv::Mat& map2) {
    cv::Mat newCameraMatrix = cv::getOptimalNewCameraMatrix(calibResult.cameraMatrix, calibResult.distCoeffs, size, 1.0);
    cv::initUndistortRectifyMap(calibResult.cameraMatrix, calibResult.distCoeffs, cv::Mat(), newCameraMatrix, size, CV_16SC2, map1, map2);
    cv::Mat undistorted;
    cv::remap(image, undistorted, map1, map2, cv::INTER_LINEAR);
    return undistorted;
}

static MetricResult computeMetric(const CalibrationResult& globalCalib,
                                  const CalibrationResult& roiCalib,
                                  const cv::Rect& roi,
                                  const CalibrationConfig& config,
                                  int gridCols = 40,
                                  int gridRows = 40) {
    MetricResult metric;
    std::vector<cv::Point2f> grid;
    grid.reserve(static_cast<size_t>(gridCols * gridRows));

    for (int y = 0; y < gridRows; ++y) {
        for (int x = 0; x < gridCols; ++x) {
            float px = static_cast<float>(x) / static_cast<float>(gridCols - 1);
            float py = static_cast<float>(y) / static_cast<float>(gridRows - 1);
            grid.emplace_back(px * static_cast<float>(config.imageSize.width - 1),
                              py * static_cast<float>(config.imageSize.height - 1));
        }
    }

    std::vector<cv::Point2f> undistortedGlobal, undistortedRoi;
    cv::undistortPoints(grid, undistortedGlobal, globalCalib.cameraMatrix, globalCalib.distCoeffs, cv::Mat(), globalCalib.cameraMatrix);
    cv::undistortPoints(grid, undistortedRoi, roiCalib.cameraMatrix, roiCalib.distCoeffs, cv::Mat(), roiCalib.cameraMatrix);

    for (size_t i = 0; i < grid.size(); ++i) {
        const double shift = cv::norm(undistortedGlobal[i] - undistortedRoi[i]);
        if (roi.contains(grid[i])) {
            metric.meanShiftInside += shift;
            ++metric.samplesInside;
        } else {
            metric.meanShiftOutside += shift;
            ++metric.samplesOutside;
        }
    }

    if (metric.samplesInside > 0) {
        metric.meanShiftInside /= static_cast<double>(metric.samplesInside);
    }
    if (metric.samplesOutside > 0) {
        metric.meanShiftOutside /= static_cast<double>(metric.samplesOutside);
    }
    return metric;
}

static void writeCsv(const fs::path& path, const std::vector<std::vector<std::string>>& rows) {
    ensureDirectory(path.parent_path());
    std::ofstream os(path);
    if (!os) {
        throw std::runtime_error("Failed to open CSV for writing: " + path.string());
    }
    for (const auto& row : rows) {
        for (size_t i = 0; i < row.size(); ++i) {
            os << row[i];
            if (i + 1 < row.size()) {
                os << ',';
            }
        }
        os << '\n';
    }
}

static void writeYaml(const fs::path& path, const CalibrationResult& calib) {
    ensureDirectory(path.parent_path());
    cv::FileStorage fsOut(path.string(), cv::FileStorage::WRITE);
    if (!fsOut.isOpened()) {
        throw std::runtime_error("Failed to open YAML for writing: " + path.string());
    }
    fsOut << "camera_matrix" << calib.cameraMatrix;
    fsOut << "distortion_coefficients" << calib.distCoeffs;
    fsOut << "rvecs" << '[';
    for (const auto& rvec : calib.rvecs) {
        fsOut << rvec;
    }
    fsOut << ']';
    fsOut << "tvecs" << '[';
    for (const auto& tvec : calib.tvecs) {
        fsOut << tvec;
    }
    fsOut << ']';
    fsOut.release();
}

static void saveDifferences(const cv::Mat& undistortedGlobal, const cv::Mat& roiMaskUndistorted, const fs::path& outputPath) {
    cv::Mat diff;
    cv::absdiff(undistortedGlobal, roiMaskUndistorted, diff);
    saveImage(outputPath, diff);
}

static void saveSideBySide(const cv::Mat& left, const cv::Mat& right, const fs::path& outputPath) {
    cv::Mat leftResized, rightResized;
    const int height = std::max(left.rows, right.rows);
    const double scaleLeft = static_cast<double>(height) / static_cast<double>(left.rows);
    const double scaleRight = static_cast<double>(height) / static_cast<double>(right.rows);
    cv::resize(left, leftResized, cv::Size(), scaleLeft, scaleLeft);
    cv::resize(right, rightResized, cv::Size(), scaleRight, scaleRight);
    cv::Mat canvas(height, leftResized.cols + rightResized.cols, left.type());
    leftResized.copyTo(canvas(cv::Rect(0, 0, leftResized.cols, height)));
    rightResized.copyTo(canvas(cv::Rect(leftResized.cols, 0, rightResized.cols, height)));
    saveImage(outputPath, canvas);
}

static void writeSummary(const fs::path& path,
                         const CalibrationResult& globalCalib,
                         const CalibrationResult& roiCalib,
                         const MetricResult& metrics) {
    writeCsv(path, {
        {"model", "rms", "mean_shift_inside", "mean_shift_outside"},
        {"global", std::to_string(globalCalib.rms), std::to_string(metrics.meanShiftInside), std::to_string(metrics.meanShiftOutside)},
        {"roi", std::to_string(roiCalib.rms), std::to_string(metrics.meanShiftInside), std::to_string(metrics.meanShiftOutside)}
    });
}

static void processDataset(const fs::path& inputDir, const fs::path& outputDir, const CalibrationConfig& config) {
    const auto imagePaths = collectImages(inputDir);
    std::vector<ImageRecord> records;
    records.reserve(imagePaths.size());

    std::vector<cv::Rect> detectedRects;
    auto objectPattern = buildObjectPattern(config.boardSize, config.squareSizeMm);

    for (const auto& path : imagePaths) {
        ImageRecord record;
        record.inputPath = path;
        record.original = cv::imread(path.string(), cv::IMREAD_COLOR);
        if (record.original.empty()) {
            std::cerr << "Skipping " << path << ": unable to load image\n";
            continue;
        }
        if (record.original.size() != config.imageSize) {
            std::cerr << "Warning: image size mismatch for " << path << " (expected "
                      << config.imageSize << ", got " << record.original.size() << ")\n";
        }
        cv::cvtColor(record.original, record.gray, cv::COLOR_BGR2GRAY);

        const auto start = std::chrono::steady_clock::now();
        auto cornersSB = detectCornersSB(record.gray, config.boardSize);
        if (cornersSB) {
            record.cornersGlobal = *cornersSB;
            record.cornersFound = true;
        } else if (auto cornersClassic = detectCornersClassic(record.gray, config)) {
            record.cornersGlobal = *cornersClassic;
            record.cornersFound = true;
        }
        const auto end = std::chrono::steady_clock::now();
        record.detectionTimeMs = std::chrono::duration<double, std::milli>(end - start).count();

        if (record.cornersFound) {
            auto rect = boundingRectOfCorners(record.cornersGlobal);
            detectedRects.push_back(rect);
        } else {
            std::cerr << "Chessboard not found in " << path << '\n';
        }

        if (config.saveIntermediate) {
            saveImage(outputDir / "original" / path.filename(), record.original);
        }

        records.push_back(std::move(record));
    }

    if (records.empty()) {
        throw std::runtime_error("No valid images processed; aborting");
    }

    cv::Rect globalRoi = medianRoi(detectedRects, config.imageSize);

    std::vector<std::vector<cv::Point3f>> objectPointsGlobal;
    std::vector<std::vector<cv::Point2f>> imagePointsGlobal;
    std::vector<std::vector<cv::Point3f>> objectPointsRoi;
    std::vector<std::vector<cv::Point2f>> imagePointsRoi;

    size_t validImages = 0;
    for (auto& record : records) {
        if (!record.cornersFound) {
            continue;
        }
        ++validImages;

        cv::Mat annotated = record.original.clone();
        cv::drawChessboardCorners(annotated, config.boardSize, record.cornersGlobal, true);
        drawHeader(annotated, "Corners: " + std::to_string(record.cornersGlobal.size()));
        if (config.saveIntermediate) {
            saveImage(outputDir / "corners" / record.inputPath.filename(), annotated);
        }

        record.roi = globalRoi;
        record.cornersRoi = filterCornersByRoi(record.cornersGlobal, globalRoi);
        record.roiCornersFound = !record.cornersRoi.empty();

        objectPointsGlobal.push_back(objectPattern);
        imagePointsGlobal.push_back(record.cornersGlobal);

        if (record.roiCornersFound) {
            objectPointsRoi.push_back(buildObjectSubset(record.cornersRoi, config.boardSize, config.squareSizeMm, record.cornersGlobal));
            imagePointsRoi.push_back(record.cornersRoi);
        }

        cv::Mat roiOverlay = record.original.clone();
        cv::rectangle(roiOverlay, globalRoi, cv::Scalar(0, 255, 0), 2);
        drawHeader(roiOverlay, "ROI " + std::to_string(globalRoi.width) + "x" + std::to_string(globalRoi.height));
        if (config.saveIntermediate) {
            saveImage(outputDir / "roi_overlay" / record.inputPath.filename(), roiOverlay);
        }
    }

    if (validImages < 3) {
        throw std::runtime_error("Need at least 3 successful detections for calibration; got " + std::to_string(validImages));
    }

    if (objectPointsRoi.size() < 3) {
        throw std::runtime_error("ROI calibration requires at least 3 valid views; got " + std::to_string(objectPointsRoi.size()));
    }

    auto globalCalib = calibrate(objectPointsGlobal, imagePointsGlobal, config);
    auto roiCalib = calibrate(objectPointsRoi, imagePointsRoi, config);

    for (size_t i = 0, gi = 0, ri = 0; i < records.size(); ++i) {
        auto& record = records[i];
        if (!record.cornersFound) {
            continue;
        }
        record.reprojectionErrorGlobal = globalCalib.perViewErrors[gi++];
        if (record.roiCornersFound && ri < roiCalib.perViewErrors.size()) {
            record.reprojectionErrorRoi = roiCalib.perViewErrors[ri++];
        }
    }

    // Undistortion and exports
    for (const auto& record : records) {
        if (!record.cornersFound) {
            continue;
        }
        cv::Mat map1Global, map2Global, map1Roi, map2Roi;
        cv::Mat undistortedGlobal = undistortWithMaps(record.original, globalCalib, config.imageSize, map1Global, map2Global);
        cv::Mat roiMask = makeRoiMask(config.imageSize, record.roi);
        cv::Mat roiMaskColor;
        cv::cvtColor(roiMask, roiMaskColor, cv::COLOR_GRAY2BGR);
        cv::Mat undistortedMask = undistortWithMaps(roiMaskColor, globalCalib, config.imageSize, map1Roi, map2Roi);

        if (config.saveIntermediate) {
            saveImage(outputDir / "undistorted" / record.inputPath.filename(), undistortedGlobal);
            saveImage(outputDir / "mask_undistorted" / record.inputPath.filename(), undistortedMask);
            saveSideBySide(record.original, undistortedGlobal, outputDir / "side_by_side" / record.inputPath.filename());
            saveDifferences(undistortedGlobal, undistortedMask, outputDir / "diff" / record.inputPath.filename());
        }
    }

    MetricResult metric = computeMetric(globalCalib, roiCalib, globalRoi, config);

    // CSV exports
    {
        std::vector<std::vector<std::string>> rows = {
            {"image", "corners", "reproj_error_global", "reproj_error_roi", "detection_ms"}
        };
        for (const auto& record : records) {
            rows.push_back({record.inputPath.filename().string(),
                            std::to_string(record.cornersGlobal.size()),
                            std::to_string(record.reprojectionErrorGlobal),
                            std::to_string(record.reprojectionErrorRoi),
                            std::to_string(record.detectionTimeMs)});
        }
        writeCsv(outputDir / "per_view_rms.csv", rows);
    }

    writeSummary(outputDir / "summary.csv", globalCalib, roiCalib, metric);
    writeYaml(outputDir / "calibration_global.yml", globalCalib);
    writeYaml(outputDir / "calibration_roi.yml", roiCalib);

    std::cout << "Global RMS: " << globalCalib.rms << " px\n";
    std::cout << "ROI RMS:    " << roiCalib.rms << " px\n";
    std::cout << "Mean shift inside ROI:  " << metric.meanShiftInside << " px\n";
    std::cout << "Mean shift outside ROI: " << metric.meanShiftOutside << " px\n";
}

int main(int argc, char** argv) {
    if (argc < 3) {
        std::cerr << "Usage: " << argv[0] << " <input_dir> <output_dir> [--interactive-roi]\n";
        return 1;
    }

    CalibrationConfig config;
    config.useInteractiveRoi = (argc > 3 && std::string(argv[3]) == "--interactive-roi");

    try {
        processDataset(argv[1], argv[2], config);
    } catch (const std::exception& ex) {
        std::cerr << "Error: " << ex.what() << '\n';
        return 1;
    }

    return 0;
}
