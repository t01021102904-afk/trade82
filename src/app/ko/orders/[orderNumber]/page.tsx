import { OrderDetailClient } from "@/components/orders-client";

export default async function KoreanOrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) { return <OrderDetailClient orderNumber={(await params).orderNumber} locale="ko" />; }
