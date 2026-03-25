import { api } from './api';

export type AccountOption = {
  id: string;
  name: string;
};

export const fetchAccountOptions = async (): Promise<AccountOption[]> => {
  const response = await api.get('/accounts');

  return (response.data?.data ?? []).map((item: { id: string; name: string }) => ({
    id: item.id,
    name: item.name,
  }));
};