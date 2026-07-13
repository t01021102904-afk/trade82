import { OrderDetailClient } from "@/components/orders-client";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) { return <OrderDetailClient orderNumber={(await params).orderNumber} locale="en" />; }
