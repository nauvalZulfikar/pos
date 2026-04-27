import { Navigate, Route, Routes, Link, useLocation } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';
import { useSessionStore } from './stores/session.js';
import { PinLoginScreen } from './screens/PinLogin.js';
import { OrderEntryScreen } from './screens/OrderEntry.js';
import { KdsScreen } from './screens/Kds.js';
import { ShiftScreen } from './screens/Shift.js';
import { TablesScreen } from './screens/Tables.js';
import { PaymentScreen } from './screens/Payment.js';

export function App() {
  const tenantId = useSessionStore((s) => s.tenantId);
  const isAuthed = !!tenantId;

  return (
    <div className="flex h-full flex-col">
      {isAuthed ? <TopNav /> : null}
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/login-pin" element={<PinLoginScreen />} />
          <Route
            path="/tables"
            element={isAuthed ? <TablesScreen /> : <Navigate to="/login-pin" replace />}
          />
          <Route
            path="/order"
            element={isAuthed ? <OrderEntryScreen /> : <Navigate to="/login-pin" replace />}
          />
          <Route
            path="/kds"
            element={isAuthed ? <KdsScreen /> : <Navigate to="/login-pin" replace />}
          />
          <Route
            path="/shift"
            element={isAuthed ? <ShiftScreen /> : <Navigate to="/login-pin" replace />}
          />
          <Route
            path="/pay"
            element={isAuthed ? <PaymentScreen /> : <Navigate to="/login-pin" replace />}
          />
          <Route path="*" element={<Navigate to={isAuthed ? '/tables' : '/login-pin'} replace />} />
        </Routes>
      </main>
    </div>
  );
}

function TopNav() {
  const loc = useLocation();
  const navItems = [
    { to: '/tables', labelId: 'pos.tables' },
    { to: '/order', labelId: 'pos.newOrder' },
    { to: '/kds', labelId: 'pos.openOrders' },
    { to: '/shift', labelId: 'shift.open' },
  ] as const;

  return (
    <nav className="flex items-center gap-1 border-b border-slate-200 bg-white px-4 py-2">
      <span className="mr-3 text-sm font-bold text-emerald-700">DESAIN POS</span>
      {navItems.map((item) => {
        const active = loc.pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <FormattedMessage id={item.labelId} />
          </Link>
        );
      })}
    </nav>
  );
}
