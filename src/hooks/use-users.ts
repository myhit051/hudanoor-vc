import { useQuery } from '@tanstack/react-query';
import { getActiveUserNames } from '@/lib/auth-api';

// รายชื่อบัญชีผู้ใช้งานที่ active — ใช้เป็นตัวเลือก "ผู้บันทึก" ในหน้าประวัติการขาย
export const useUsers = () => {
  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ['user-names'],
    queryFn: getActiveUserNames,
    staleTime: 30 * 1000,
    retry: 1,
    refetchOnWindowFocus: false
  });

  return { users, isLoading, error, refetch };
};
