import { useQuery } from '@tanstack/react-query';
import { getActiveUserNames } from '@/lib/auth-api';

// รายชื่อบัญชีผู้ใช้งานที่ active — ใช้เป็นตัวเลือก "ผู้บันทึก" ในหน้าประวัติการขาย/บันทึกยอดขาย
export const useUsers = (options?: { enabled?: boolean }) => {
  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ['user-names'],
    enabled: options?.enabled ?? true,
    queryFn: getActiveUserNames,
    staleTime: 30 * 1000,
    retry: 1,
    refetchOnWindowFocus: false
  });

  return { users, isLoading, error, refetch };
};
