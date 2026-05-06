import { Card, CardContent } from "../components/ui/card";
import { Package } from "lucide-react";

export function Inventory() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>المخزون</h1><p className="text-[#6B7280] mt-1">إدارة المنتجات والمستودعات</p></div>
      <Card className="border-[#E5E7EB]"><CardContent className="py-12 text-center">
        <Package className="h-12 w-12 mx-auto text-[#9CA3AF] mb-4" />
        <h3 className="text-[#0B1B49]" style={{ fontSize: "1.1rem", fontWeight: 600 }}>قريباً · Sprint 4</h3>
        <p className="text-sm text-[#6B7280] mt-2 max-w-md mx-auto">إدارة كاملة للمخزون مع تتبع الحركات · حد إعادة الطلب · COGS · WAC.<br />حالياً يمكنك إدارة المنتجات/الخدمات من <a href="/app/products" className="text-[#1276E3] hover:underline">صفحة المنتجات</a>.</p>
      </CardContent></Card>
    </div>
  );
}
