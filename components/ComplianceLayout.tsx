import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { useComplianceGuard } from '../hooks/useComplianceGuard';

interface ComplianceLayoutProps {
  session: Session;
}

const ComplianceLayout: React.FC<ComplianceLayoutProps> = ({ session }) => {
  const location = useLocation();
  const { loading, redirectTo } = useComplianceGuard(
    session.user.id,
    location.pathname
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (redirectTo && location.pathname !== redirectTo) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export default ComplianceLayout;
