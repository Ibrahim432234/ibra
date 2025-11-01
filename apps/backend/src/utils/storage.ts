import fs from 'fs-extra';
import path from 'path';

const storageRoot = path.resolve(process.cwd(), 'storage', 'pdfs');

export const uploadPdfBuffer = async (userId: string, invoiceNumber: string, buffer: Buffer): Promise<string> => {
  const safeInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
  const fileName = `${safeInvoiceNumber}.pdf`;
  const userDir = path.join(storageRoot, userId);

  await fs.ensureDir(userDir);
  const filePath = path.join(userDir, fileName);
  await fs.writeFile(filePath, buffer);

  return filePath;
};
