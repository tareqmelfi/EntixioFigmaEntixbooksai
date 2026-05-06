import { useState } from "react";
import {
  GitBranch, Plus, MapPin, Users, DollarSign, Edit2, Trash2, MoreVertical, Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";

const CUR = "SR";

const branches = [
  { id: "BR-001", name: "الفرع الرئيسي - الرياض", address: "الرياض، حي الملك فيصل، شارع العليا", manager: "محمد أحمد", employees: 45, revenue: 3200000, status: "نشط" },
  { id: "BR-002", name: "فرع جدة", address: "جدة، حي الحمراء، شارع فلسطين", manager: "خالد العمري", employees: 22, revenue: 1800000, status: "نشط" },
  { id: "BR-003", name: "فرع الدمام", address: "الدمام، حي الفيصلية، طريق الملك فهد", manager: "عبدالله السالم", employees: 15, revenue: 950000, status: "نشط" },
  { id: "BR-004", name: "فرع المدينة المنورة", address: "المدينة المنورة، حي العزيزية", manager: "—", employees: 0, revenue: 0, status: "قيد التأسيس" },
];

const statusStyle = (s: string) => {
  const m: Record<string, string> = {
    "نشط": "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20",
    "قيد التأسيس": "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]",
    "مغلق": "bg-[#E4F4F9] text-[#2A7F9E] border-[#349FC4]",
  };
  return m[s] || "";
};

export function Branches() {
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    manager: "",
    status: "قيد التأسيس"
  });

  const totalEmployees = branches.reduce((s, b) => s + b.employees, 0);
  const totalRevenue = branches.reduce((s, b) => s + b.revenue, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // هنا يمكن إضافة المنطق لحفظ البيانات
    console.log("New Branch:", formData);
    setIsDialogOpen(false);
    setFormData({ name: "", address: "", manager: "", status: "قيد التأسيس" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الفروع</h1>
          <p className="text-[#6B7280] mt-1">إدارة فروع الشركة والمواقع</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setIsDialogOpen(true)}><Plus className="me-2 h-4 w-4" />فرع جديد</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><GitBranch className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{branches.length}</div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الفروع</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><Users className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <div className="text-[#0B1A47] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{totalEmployees}</div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الموظفين</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><DollarSign className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{CUR}</span>
              <span className="text-[#0B1A47] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{(totalRevenue / 1000000).toFixed(1)}M</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الإيرادات</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#E4F4F9] p-2.5"><MapPin className="h-5 w-5 text-[#349FC4]" /></div></div>
            <div className="text-[#349FC4] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>4</div>
            <p className="text-xs text-[#6B7280] mt-1">مدن</p>
          </CardContent>
        </Card>
      </div>

      {/* Branch Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {branches.map((b) => (
          <Card key={b.id} className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3 gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="rounded-xl bg-[#EFF6FF] p-2.5 flex-shrink-0"><GitBranch className="h-5 w-5 text-[#1276E3]" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[#0B1B49]" style={{ fontWeight: 600 }}>{b.name}</span>
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] border whitespace-nowrap ${statusStyle(b.status)}`} style={{ fontWeight: 600 }}>{b.status}</span>
                    </div>
                    <div className="flex items-start gap-1 mt-0.5 text-xs text-[#6B7280]">
                      <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      <span className="overflow-hidden text-ellipsis" title={b.address}>{b.address}</span>
                    </div>
                  </div>
                </div>
                <button className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] flex-shrink-0"><MoreVertical className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-[#F3F4F6]">
                <div className="min-w-0">
                  <div className="text-xs text-[#9CA3AF]">المدير</div>
                  <div className="text-sm text-[#374151] overflow-hidden text-ellipsis" style={{ fontWeight: 500 }} title={b.manager}>{b.manager}</div>
                </div>
                <div>
                  <div className="text-xs text-[#9CA3AF]">الموظفون</div>
                  <div className="text-sm text-[#0B1B49] font-english" style={{ fontWeight: 600 }}>{b.employees}</div>
                </div>
                <div>
                  <div className="text-xs text-[#9CA3AF]">الإيرادات</div>
                  <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm whitespace-nowrap" style={{ fontWeight: 600 }}>
                    <span className="text-[#9CA3AF]" style={{ fontSize: "0.5rem" }}>{CUR}</span>
                    <span className="text-[#0B1A47]">{b.revenue > 0 ? (b.revenue / 1000).toFixed(0) + "K" : "—"}</span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog for New Branch */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[#0B1B49]">فرع جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[#374151]">اسم الفرع *</Label>
                <Input
                  id="name"
                  placeholder="مثال: فرع مكة المكرمة"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="border-[#E5E7EB]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="text-[#374151]">العنوان *</Label>
                <Textarea
                  id="address"
                  placeholder="مثال: مكة المكرمة، حي العزيزية، شارع الحرمين"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  className="border-[#E5E7EB] min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager" className="text-[#374151]">المدير (اختياري)</Label>
                <Input
                  id="manager"
                  placeholder="مثال: عبدالله السالم"
                  value={formData.manager}
                  onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                  className="border-[#E5E7EB]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status" className="text-[#374151]">الحالة *</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger className="border-[#E5E7EB]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="نشط">نشط</SelectItem>
                    <SelectItem value="قيد التأسيس">قيد التأسيس</SelectItem>
                    <SelectItem value="مغلق">مغلق</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-[#E5E7EB]">
                إلغاء
              </Button>
              <Button type="submit" className="bg-[#1276E3] hover:bg-[#1060C0]">
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}