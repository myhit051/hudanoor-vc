import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getEmployeesData, 
  addEmployeeRecord, 
  updateEmployeeRecord, 
  deleteEmployeeRecord 
} from '@/lib/vercel-employees';
import { Employee } from '@/types/employee';
import { toast } from '@/hooks/use-toast';

// Helper function to ensure employee data has correct structure
const normalizeEmployeeData = (employees: any[]): Employee[] => {
  return employees.map(employee => ({
    ...employee,
    branchCommissions: Array.isArray(employee.branchCommissions) 
      ? employee.branchCommissions 
      : []
  }));
};

export const useEmployees = () => {
  const queryClient = useQueryClient();

  const {
    data: rawEmployees = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployeesData,
    staleTime: 30 * 1000, // 30 seconds
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Normalize employee data to ensure correct structure
  const employees = normalizeEmployeeData(rawEmployees);

  const addEmployeeMutation = useMutation({
    mutationFn: addEmployeeRecord,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      await refetch();
      
      toast({
        title: "เพิ่มพนักงานสำเร็จ",
        description: "บันทึกข้อมูลพนักงานเรียบร้อยแล้ว"
      });
    },
    onError: (error) => {
      console.error('Error adding employee:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถเพิ่มพนักงานได้",
        variant: "destructive"
      });
    }
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: ({ employeeId, updates }: { employeeId: string; updates: Partial<Employee> }) => 
      updateEmployeeRecord(employeeId, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      await refetch();
      
      toast({
        title: "อัปเดตพนักงานสำเร็จ",
        description: "บันทึกการเปลี่ยนแปลงแล้ว"
      });
    },
    onError: (error) => {
      console.error('Error updating employee:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถอัปเดตพนักงานได้",
        variant: "destructive"
      });
    }
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: deleteEmployeeRecord,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      await refetch();
      
      toast({
        title: "ลบพนักงานสำเร็จ",
        description: "ลบพนักงานออกจากระบบแล้ว"
      });
    },
    onError: (error) => {
      console.error('Error deleting employee:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลบพนักงานได้",
        variant: "destructive"
      });
    }
  });

  return {
    employees,
    isLoading,
    error,
    refetch,
    addEmployee: addEmployeeMutation.mutate,
    updateEmployee: updateEmployeeMutation.mutate,
    deleteEmployee: deleteEmployeeMutation.mutate,
    isAddingEmployee: addEmployeeMutation.isPending,
    isUpdatingEmployee: updateEmployeeMutation.isPending,
    isDeletingEmployee: deleteEmployeeMutation.isPending
  };
};