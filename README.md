# SANGAM NEXUS — Business Management System

This upgraded local web app is based on the supplied Shivaay International inventory project and preserves the existing 3,489-product master under **Shivaay International Pvt. Ltd.**

## Run
### Easiest way
1. Install Node.js 18+ once.
2. Double-click `START.bat`.
3. If dependencies are missing, double-click `INSTALL_AND_START.bat` once instead.
4. Open `http://localhost:3000`.

### Command Prompt
1. Open this folder in Command Prompt/PowerShell.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000`.

## Default local login
- Company: Shivaay International Pvt. Ltd.
- Username: `admin`
- Password: `admin123`

Change this password/user after first login when deploying for real use.

## Main additions
- Pink/red Sangam Nexus dashboard UI.
- Multi-company database isolation and company switcher.
- Shivaay's existing product master stays in Shivaay; new companies can maintain their own product masters.
- FSV / RX Sales Order choice. FSV uses an existing stock product; RX opens blank product fields for a special/direct order.
- RX orders automatically create an RX product in the current company's Inventory with opening/current stock of 0; the order itself does not add physical stock. Actual stock is increased by Purchase or Opening Stock.
- Sales Order, Sales Return + Credit Note, and FOC Issued.
- Stock logic: normal sales reduce stock; sales returns add stock; FOC reduces stock; RX sales do not reduce stock because they are direct-order items, while RX returns add stock.
- Product selection with Select All / individual selection and guarded bulk deletion.
- Financing view with party, sales bill number/date and total amount.
- Payments, receivables/payables style party ledger, and ledger summary.
- Customers/Suppliers/parties.
- Users & Roles with module permissions.
- Developer details: Sangam Bhusal / sangam23bhusal@gmail.com / +977 9761691545.
- Excel export for inventory, orders, purchases, parties, payments and returns; Excel import for inventory and parties.

## Multi-company workflow
1. Open **Settings → Add Company**.
2. Give the company a unique name and short code.
3. Switch to that company from the left sidebar.
4. Add its products manually or import its inventory Excel.
5. Create a user from **Users & Roles** while that company is selected.
6. Tick only the modules that user should access.
7. Give the user their username/password securely.

## Excel
Use the Import / Export page. Export produces a real `.xlsx` file. Inventory import expects columns such as `Brand`, `Product`, `Opening Stock`, and optional `RX` (`Yes`/`No`). Party import accepts `Name`, `Type`, `Phone`, `Address`, `Email`, and `OpeningBalance`.

## Transaction deletion & ledger synchronization
- Sales Orders, including RX orders, can be deleted from the Sales screen.
- Deleting a sales order removes payments tied to its bill number so the party Ledger does not retain a stale receipt/payment balance.
- Deleting a Sales Return also deletes its linked Credit Note; stock and Ledger totals are recalculated from the remaining transactions.
- Deleting an FOC restores its stock automatically because current stock is calculated from live transaction tables.
- Payments can be deleted directly; the Ledger recalculates immediately.
- Editing a sales bill number also carries linked payments to the new bill number.
