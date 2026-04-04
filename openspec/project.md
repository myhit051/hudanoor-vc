# Project Context

## Purpose
ระบบจัดการบัญชีและพนักงานสำหรับธุรกิจขายสินค้า (Hudanoor VC) ที่รองรับการขายทั้งหน้าร้านและออนไลน์ มีระบบติดตามรายได้-รายจ่าย การคำนวณค่าคอมมิชชั่นพนักงานตามสาขาและแพลตฟอร์ม และการจัดการข้อมูลพนักงานที่ซิงค์กับ Google Sheets

**คุณสมบัติหลัก:**
- Dashboard สำหรับแสดงรายได้-รายจ่ายแบบ Real-time
- ระบบคำนวณค่าคอมมิชชั่นพนักงานตามสาขา (หน้าร้าน) และแพลตฟอร์ม (ออนไลน์)
- รายงานค่าคอมมิชชั่นรายเดือนแบบละเอียด
- การจัดการข้อมูลพนักงานที่ซิงค์กับ Google Sheets
- ระบบตั้งค่าเป้าหมายยอดขายรายเดือน
- Task Reminder และ Update Logs

## Tech Stack
- **Frontend Framework:** React 18.3.1 with TypeScript 5.8.3
- **Build Tool:** Vite 5.4.19 with SWC plugin
- **Styling:** Tailwind CSS 3.4.17 + shadcn/ui (Radix UI components)
- **State Management:** TanStack React Query 5.83.0
- **Routing:** React Router DOM 6.30.1
- **Form Management:** React Hook Form 7.61.1 + Zod 3.25.76 validation
- **Charts:** Recharts 2.15.4
- **Date Handling:** date-fns 3.6.0
- **Backend/API:** Vercel Serverless Functions
- **Data Storage:** Google Sheets (via googleapis 144.0.0)
- **UI Components:** Radix UI primitives with custom theming
- **Theme:** next-themes 0.4.6 (light/dark mode support)
- **Notifications:** Sonner 1.7.4

## Project Conventions

### Code Style
- **Language:** TypeScript with strict type checking
- **Component Style:** Functional components with hooks
- **Naming Conventions:**
  - Components: PascalCase (e.g., `AddRecordForm`, `TrendChart`)
  - Files: kebab-case for utilities, PascalCase for components (e.g., `use-sheets-data.ts`, `EmployeeManagement.tsx`)
  - Variables/Functions: camelCase (e.g., `addIncome`, `isLoading`)
  - Types/Interfaces: PascalCase (e.g., `Employee`, `BranchCommission`)
- **Import Alias:** Use `@/` for src directory imports
- **Comments:** Thai language comments for domain-specific logic, English for general code
- **Formatting:** ESLint with React hooks plugin and React Refresh plugin

### Architecture Patterns
- **Component Structure:**
  - `/src/components/ui/` - Reusable UI primitives (shadcn/ui)
  - `/src/components/dashboard/` - Dashboard-specific components
  - `/src/components/forms/` - Form components
  - `/src/components/layout/` - Layout components (Sidebar, MainLayout)
  - `/src/pages/` - Page-level components (route handlers)
- **Data Flow:**
  - Custom hooks in `/src/hooks/` for data fetching and state management
  - API adapters in `/src/lib/` (e.g., `vercel-employees.ts`, `vercel-sheets.ts`)
  - Serverless functions in `/api/` directory
- **Type Definitions:** Centralized in `/src/types/`
- **State Management:** React Query for server state, React Context for theme
- **API Layer:** Vercel serverless functions that interact with Google Sheets API

### Testing Strategy
- **Current:** No formal testing framework configured yet
- **Linting:** ESLint with TypeScript support
- **Build Validation:** TypeScript compilation checks
- **Future Considerations:** Consider adding Vitest for unit tests

### Git Workflow
- **Main Branch:** `main`
- **Commit Convention:** Gitmoji-style commits with Thai descriptions
  - `✨` for new features (feat)
  - `🐛` for bug fixes (fix)
  - `♻️` for refactoring (refactor)
  - `📝` for documentation (docs)
- **Commit Messages:** Primarily in Thai language
- **Example:** `✨ Add month selector dropdown to commission reports`

## Domain Context

### ธุรกิจ (Business Domain)
- **ประเภทธุรกิจ:** ขายสินค้าทั้งหน้าร้านและออนไลน์
- **ช่องทางขาย (Sales Channels):**
  - **หน้าร้าน (Store):** หลายสาขา (branches)
  - **ออนไลน์ (Online):** หลายแพลตฟอร์ม (platforms)

### ระบบค่าคอมมิชชั่น (Commission System)
- พนักงานแต่ละคนสามารถมีอัตราค่าคอมมิชชั่นที่แตกต่างกันตามสาขาและแพลตฟอร์ม
- โครงสร้าง: `BranchCommission[]` ที่เก็บ channel (store/online), branchOrPlatform, และ commissionRate
- การคำนวณ: ยอดขาย × อัตราค่าคอมมิชชั่น = ค่าคอมมิชชั่น
- รายได้รวม: เงินเดือนฐาน + ค่าคอมมิชชั่นทั้งหมด

### การจัดการข้อมูล (Data Management)
- **Income/Expense Records:** วันที่, จำนวนเงิน, หมวดหมู่, ช่องทาง, สาขา/แพลตฟอร์ม
- **Employee Records:** ชื่อ, ตำแหน่ง, เงินเดือน, วันที่เริ่มงาน, ข้อมูลติดต่อ, การตั้งค่าคอมมิชชั่น
- **Settings:** เป้าหมายยอดขายรายเดือน, รายชื่อสาขาและแพลตฟอร์ม

### ภาษา (Language)
- **UI/UX:** ภาษาไทย (Thai language)
- **Code:** ตัวแปรและฟังก์ชันเป็นภาษาอังกฤษ, comments และ UI text เป็นภาษาไทย
- **Documentation:** Mixed Thai/English (Thai for business domain, English for technical)

## Important Constraints

### Technical Constraints
- **Deployment:** Vercel platform (serverless functions)
- **Data Storage:** Google Sheets as the primary database
- **API Limits:** Google Sheets API rate limits and quota
- **Browser Support:** Modern browsers with ES6+ support
- **No Backend Database:** All data persisted in Google Sheets

### Business Constraints
- **Currency:** Thai Baht (฿) - handle various formats: "15,000", "฿15,000", "15 000"
- **Commission Rates:** Percentage-based (stored as decimal, e.g., 0.05 = 5%)
- **Multi-Branch Support:** Must support multiple store branches and online platforms
- **Real-time Sync:** Data should sync with Google Sheets for access across devices

### Security Constraints
- **Authentication:** Google OAuth for Sheets access
- **API Keys:** Stored as environment variables on Vercel
- **Data Privacy:** Employee salary and commission data is sensitive

## External Dependencies

### Google Services
- **Google Sheets API:** Primary data storage and retrieval
  - Income/Expense tracking
  - Employee management
  - Commission reports
  - Settings storage
- **Google OAuth 2.0:** Authentication for API access

### Vercel Platform
- **Vercel Serverless Functions:** Backend API endpoints
  - `/api/sheets.js` - General sheets operations
  - `/api/commission-reports.js` - Commission calculations
  - `/api/employees.js` - Employee CRUD operations
  - `/api/settings.js` - App settings management
  - `/api/tasks.js` - Task reminder operations
- **Environment Variables:**
  - Google API credentials
  - Spreadsheet IDs

### UI Libraries
- **Radix UI:** Accessible component primitives
- **Lucide React:** Icon library
- **Recharts:** Data visualization
- **Tailwind CSS:** Utility-first styling
