import useSWR from 'swr';
import api from '../lib/api';
import type { ApiResponse, AuthUser } from '@autoinvoice/shared';

const fetcher = async (url: string): Promise<AuthUser | null> => {
  try {
    const { data } = await api.get<ApiResponse<AuthUser>>(url);
    return data.data ?? null;
  } catch (error) {
    return null;
  }
};

export const useAuth = () => {
  const { data, error, mutate } = useSWR('/auth/me', fetcher);

  return {
    user: data,
    loading: data === undefined && error === undefined,
    error,
    mutate
  };
};
