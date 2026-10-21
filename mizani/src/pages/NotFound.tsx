import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';

export default function NotFound() {
  return <EmptyState title="الصفحة غير موجودة" action={<Link to="/" className="btn-primary">العودة للرئيسية</Link>} />;
}
