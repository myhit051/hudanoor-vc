import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSalesOrders, addSalesOrder, addSalesOrders, deleteSalesOrder, NewSalesOrder } from '@/lib/sales-api';
import { toast } from '@/hooks/use-toast';

export function useSales(params?: { date?: string; sku?: string; channel?: string }) {
  const queryClient = useQueryClient();

  const { data: salesOrders = [], isLoading, refetch } = useQuery({
    queryKey: ['sales', params],
    queryFn: () => getSalesOrders(params),
    staleTime: 30 * 1000,
    retry: 1,
    refetchOnWindowFocus: false
  });

  const addMutation = useMutation({
    mutationFn: addSalesOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: 'บันทึกยอดขายสำเร็จ', description: 'เพิ่มรายการขายเข้าระบบแล้ว' });
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  });

  const addBatchMutation = useMutation({
    mutationFn: addSalesOrders,
    onSuccess: (_, orders) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: 'บันทึกยอดขายสำเร็จ', description: `เพิ่ม ${orders.length} รายการเข้าระบบแล้ว` });
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSalesOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: 'ลบรายการสำเร็จ', description: 'คืนสต๊อกเรียบร้อยแล้ว' });
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  });

  return {
    salesOrders,
    isLoading,
    refetch,
    addSale: addMutation.mutate,
    isAdding: addMutation.isPending,
    addSales: addBatchMutation.mutate,
    isAddingBatch: addBatchMutation.isPending,
    deleteSale: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending
  };
}
