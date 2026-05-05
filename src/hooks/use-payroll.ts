import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createOrRegeneratePayroll,
  deletePayrollRun,
  finalizePayrollRun,
  getPayrollByPeriod,
  listPayrollRuns,
  previewPayroll,
  reopenPayrollRun,
  updatePayrollItem,
} from '@/lib/vercel-payroll';
import { toast } from '@/hooks/use-toast';

export function usePayrollRuns() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['payroll', 'runs'],
    queryFn: listPayrollRuns,
    staleTime: 30 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  return { runs: data || [], isLoading, error, refetch };
}

export function usePayrollByPeriod(period: string | null) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['payroll', 'period', period],
    queryFn: () => (period ? getPayrollByPeriod(period) : Promise.resolve({ run: null, items: [] })),
    enabled: !!period,
    staleTime: 15 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  return {
    run: data?.run ?? null,
    items: data?.items ?? [],
    isLoading,
    isFetching,
    error,
    refetch,
  };
}

export function usePayrollPreview(period: string | null, enabled = false) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['payroll', 'preview', period],
    queryFn: () => (period ? previewPayroll(period) : Promise.resolve({ period: '', items: [] })),
    enabled: !!period && enabled,
    staleTime: 0,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  return { preview: data, isLoading, isFetching, refetch };
}

export function usePayrollMutations(period: string | null) {
  const qc = useQueryClient();

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['payroll', 'runs'] });
    if (period) await qc.invalidateQueries({ queryKey: ['payroll', 'period', period] });
  };

  const createRun = useMutation({
    mutationFn: ({ period: p, regenerate, note }: { period: string; regenerate?: boolean; note?: string }) =>
      createOrRegeneratePayroll(p, { regenerate, note }),
    onSuccess: async (result) => {
      await invalidate();
      toast({
        title: result.regenerated ? 'สร้างรอบจ่ายใหม่แล้ว' : 'สร้างรอบจ่ายเงินเดือนสำเร็จ',
        description: `${result.items.length} คน · รวม ${result.run.totalAmount.toLocaleString()} บาท`,
      });
    },
    onError: (err: any) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message || 'ไม่สามารถสร้างรอบจ่ายได้', variant: 'destructive' });
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ itemId, updates }: { itemId: string; updates: Parameters<typeof updatePayrollItem>[1] }) =>
      updatePayrollItem(itemId, updates),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (err: any) => {
      toast({ title: 'อัปเดตไม่สำเร็จ', description: err.message || '', variant: 'destructive' });
    },
  });

  const finalizeRun = useMutation({
    mutationFn: (runId: string) => finalizePayrollRun(runId),
    onSuccess: async () => {
      await invalidate();
      toast({ title: 'ปิดรอบจ่ายแล้ว', description: 'รอบนี้จะแก้ไขไม่ได้จนกว่าจะเปิดใหม่' });
    },
    onError: (err: any) => {
      toast({ title: 'ปิดรอบไม่สำเร็จ', description: err.message || '', variant: 'destructive' });
    },
  });

  const reopenRun = useMutation({
    mutationFn: (runId: string) => reopenPayrollRun(runId),
    onSuccess: async () => {
      await invalidate();
      toast({ title: 'เปิดรอบจ่ายอีกครั้ง', description: 'แก้ไขรายการได้แล้ว' });
    },
    onError: (err: any) => {
      toast({ title: 'เปิดรอบไม่สำเร็จ', description: err.message || '', variant: 'destructive' });
    },
  });

  const deleteRun = useMutation({
    mutationFn: (runId: string) => deletePayrollRun(runId),
    onSuccess: async () => {
      await invalidate();
      toast({ title: 'ลบรอบจ่ายแล้ว' });
    },
    onError: (err: any) => {
      toast({ title: 'ลบไม่สำเร็จ', description: err.message || '', variant: 'destructive' });
    },
  });

  return { createRun, updateItem, finalizeRun, reopenRun, deleteRun };
}
