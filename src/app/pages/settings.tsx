import { Building2, Users, CreditCard, Bell, Plug, Shield, Calendar, Hash, Globe, Lock, Unlock, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";

export function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الإعدادات</h1>
        <p className="text-[#6B7280] mt-1">إدارة إعدادات الحساب والشركة</p>
      </div>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="company" className="gap-2"><Building2 className="h-4 w-4" />بيانات الشركة</TabsTrigger>
          <TabsTrigger value="fiscal" className="gap-2"><Calendar className="h-4 w-4" />السنة المالية</TabsTrigger>
          <TabsTrigger value="numbering" className="gap-2"><Hash className="h-4 w-4" />الترقيم</TabsTrigger>
          <TabsTrigger value="currencies" className="gap-2"><Globe className="h-4 w-4" />العملات</TabsTrigger>
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" />المستخدمين</TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2"><Plug className="h-4 w-4" />التكاملات</TabsTrigger>
          <TabsTrigger value="billing" className="gap-2"><CreditCard className="h-4 w-4" />الاشتراك</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" />الإشعارات</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: بيانات الشركة ── */}
        <TabsContent value="company" className="space-y-4">
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]">معلومات الشركة</CardTitle>
              <CardDescription>تحديث بيانات شركتك الأساسية</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-name">اسم الشركة</Label>
                  <Input id="company-name" defaultValue="شركة Entix Books العالمية" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax-number">الرقم الضريبي</Label>
                  <Input id="tax-number" defaultValue="300000000000003" className="font-english" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commercial-register">السجل التجاري</Label>
                  <Input id="commercial-register" defaultValue="1010000000" className="font-english" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <Input id="phone" defaultValue="+966 11 511 0150" className="font-english" dir="ltr" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">العنوان</Label>
                <Input id="address" defaultValue="حي الملك فيصل، الرياض 13215، المملكة العربية السعودية، 3938 AbMuhammad Ibn Al Mudhaffar" />
              </div>
              <Separator />
              <div className="flex justify-start"><Button className="bg-[#1276E3] hover:bg-[#1060C0]">حفظ التغييرات</Button></div>
            </CardContent>
          </Card>

          {/* ZATCA Settings */}
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]">إعدادات الفوترة الإلكترونية (ZATCA)</CardTitle>
              <CardDescription>إعدادات الامتثال للفاتورة الإلكترونية السعودية</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>تفعيل الفوترة الإلكترونية</Label>
                  <p className="text-sm text-[#6B7280]">الامتثال لمتطلبات هيئة الزكاة والضريبة والجمارك (ZATCA)</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />

              {/* ZATCA Phase Indicators */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[#166534]" style={{ fontWeight: 700 }}>المرحلة 1 — الإصدار</span>
                    <Badge className="bg-green-600 text-white border-0">مفعّل</Badge>
                  </div>
                  <ul className="space-y-1 text-xs text-[#6B7280]">
                    <li className="flex items-center gap-1.5"><span className="text-green-600">✓</span>رمز QR للمستهلك (B2C)</li>
                    <li className="flex items-center gap-1.5"><span className="text-green-600">✓</span>حفظ إلكتروني</li>
                    <li className="flex items-center gap-1.5"><span className="text-green-600">✓</span>عداد غير قابل لإعادة التعيين</li>
                    <li className="flex items-center gap-1.5"><span className="text-green-600">✓</span>UUID لكل فاتورة</li>
                  </ul>
                </div>
                <div className="rounded-lg border-2 border-[#DBEAFE] bg-[#EFF6FF] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[#1E40AF]" style={{ fontWeight: 700 }}>المرحلة 2 — التكامل</span>
                    <Badge className="bg-[#1276E3] text-white border-0">جاهز</Badge>
                  </div>
                  <ul className="space-y-1 text-xs text-[#6B7280]">
                    <li className="flex items-center gap-1.5"><span className="text-[#1276E3]">✓</span>API اعتماد B2B</li>
                    <li className="flex items-center gap-1.5"><span className="text-[#1276E3]">✓</span>إبلاغ B2C خلال 24 ساعة</li>
                    <li className="flex items-center gap-1.5"><span className="text-[#1276E3]">✓</span>ربط تسلسلي مشفر (Hash)</li>
                    <li className="flex items-center gap-1.5"><span className="text-[#1276E3]">✓</span>XML/UBL 2.1 + PDF/A-3</li>
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="csid" className="font-english">CSID (Cryptographic Stamp ID)</Label>
                  <Input id="csid" placeholder="أدخل CSID الصادر من ZATCA" className="font-english" dir="ltr" />
                  <p className="text-xs text-[#6B7280]">المعرف التشفيري الصادر من هيئة الزكاة والضريبة والجمارك</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-counter">عداد الفواتير الحالي</Label>
                  <Input id="invoice-counter" defaultValue="000006" disabled className="font-english bg-[#F3F4F6]" dir="ltr" />
                  <p className="text-xs text-[#6B7280]">عداد تسلسلي غير قابل لإعادة التعيين (متطلب ZATCA)</p>
                </div>
              </div>

              {/* QR TLV Elements */}
              <div>
                <Label className="mb-2 block">عناصر رمز QR (TLV Base64) — 9 حقول</Label>
                <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { tag: "T1", name: "اسم البائع", status: "auto" },
                      { tag: "T2", name: "الرقم الضريبي", status: "auto" },
                      { tag: "T3", name: "تاريخ الفاتورة", status: "auto" },
                      { tag: "T4", name: "إجمالي الفاتورة", status: "auto" },
                      { tag: "T5", name: "مبلغ الضريبة", status: "auto" },
                      { tag: "T6", name: "Hash الفاتورة", status: "auto" },
                      { tag: "T7", name: "التوقيع الرقمي", status: "csid" },
                      { tag: "T8", name: "المفتاح العام", status: "csid" },
                      { tag: "T9", name: "ختم CSID", status: "csid" },
                    ].map((item) => (
                      <div key={item.tag} className="flex items-center gap-2 rounded-md bg-white border border-[#E5E7EB] px-2.5 py-2">
                        <span className="font-english text-[#1276E3]" style={{ fontWeight: 700 }}>{item.tag}</span>
                        <span className="text-[#374151]">{item.name}</span>
                        <span className={`ms-auto rounded-full px-1.5 py-0.5 text-[10px] ${item.status === "auto" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEF3C7] text-[#92400E]"}`} style={{ fontWeight: 600 }}>
                          {item.status === "auto" ? "تلقائي" : "CSID"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>بيئة الاختبار (Sandbox)</Label>
                <div className="flex items-center gap-3">
                  <Switch />
                  <span className="text-sm text-[#6B7280]">تفعيل بيئة الاختبار للتحقق من التكامل مع ZATCA قبل الإنتاج</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: السنة المالية ── */}
        <TabsContent value="fiscal" className="space-y-4">
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]">إعدادات السنة المالية</CardTitle>
              <CardDescription>تعريف الفترات المالية وإدارة الإقفال</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>بداية السنة المالية</Label>
                  <Input type="date" defaultValue="2026-01-01" className="font-english" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>نهاية السنة المالية</Label>
                  <Input type="date" defaultValue="2026-12-31" className="font-english" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>نوع الإقفال</Label>
                  <select className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm focus:border-[#1276E3] focus:outline-none">
                    <option>شهري</option>
                    <option>ربع سنوي</option>
                    <option>سنوي</option>
                  </select>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="mb-3 block">الفترات المالية — 2026</Label>
                <div className="rounded-lg border border-[#E5E7EB] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                        <th className="py-2.5 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الفترة</th>
                        <th className="py-2.5 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>من</th>
                        <th className="py-2.5 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>إلى</th>
                        <th className="py-2.5 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الحالة</th>
                        <th className="py-2.5 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: "يناير", from: "2026-01-01", to: "2026-01-31", status: "مقفل" },
                        { name: "فبراير", from: "2026-02-01", to: "2026-02-28", status: "مقفل" },
                        { name: "مارس", from: "2026-03-01", to: "2026-03-31", status: "مفتوح" },
                        { name: "أبريل", from: "2026-04-01", to: "2026-04-30", status: "مفتوح" },
                        { name: "مايو", from: "2026-05-01", to: "2026-05-31", status: "مستقبلي" },
                        { name: "يونيو", from: "2026-06-01", to: "2026-06-30", status: "مستقبلي" },
                      ].map((period) => (
                        <tr key={period.name} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB]">
                          <td className="py-2.5 px-4" style={{ fontWeight: 500 }}>{period.name}</td>
                          <td className="py-2.5 px-4 font-english text-[#6B7280]">{period.from}</td>
                          <td className="py-2.5 px-4 font-english text-[#6B7280]">{period.to}</td>
                          <td className="py-2.5 px-4">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                              period.status === "مقفل" ? "bg-[#FEE2E2] text-[#991B1B]" :
                              period.status === "مفتوح" ? "bg-[#DCFCE7] text-[#166534]" :
                              "bg-[#F3F4F6] text-[#6B7280]"
                            }`} style={{ fontWeight: 600 }}>
                              {period.status === "مقفل" && <Lock className="h-3 w-3" />}
                              {period.status === "مفتوح" && <Unlock className="h-3 w-3" />}
                              {period.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            {period.status === "مفتوح" && (
                              <button className="text-xs text-[#991B1B] hover:underline" style={{ fontWeight: 500 }}>إقفال</button>
                            )}
                            {period.status === "مقفل" && (
                              <button className="text-xs text-[#1276E3] hover:underline" style={{ fontWeight: 500 }}>فتح</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border-2 border-[#FEF3C7] bg-[#FEF3C7]/20 p-4">
                <div>
                  <p className="text-sm text-[#92400E]" style={{ fontWeight: 700 }}>قيود الإقفال التلقائية</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">إنشاء قيود إقفال تلقائية عند إغلاق السنة المالية (إيرادات ومصروفات → أرباح مبقاة)</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex justify-start"><Button className="bg-[#1276E3] hover:bg-[#1060C0]">حفظ الإعدادات</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: الترقيم ── */}
        <TabsContent value="numbering" className="space-y-4">
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]">إعدادات الترقيم التسلسلي</CardTitle>
              <CardDescription>تخصيص بادئة وصيغة الترقيم لكل نوع مستند</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-[#E5E7EB] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <th className="py-2.5 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>نوع المستند</th>
                      <th className="py-2.5 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>البادئة</th>
                      <th className="py-2.5 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الصيغة</th>
                      <th className="py-2.5 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>العداد الحالي</th>
                      <th className="py-2.5 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>مثال</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { type: "فواتير المبيعات", prefix: "INV", format: "{PREFIX}-{YEAR}-{SEQ:3}", counter: 6, example: "INV-2026-006" },
                      { type: "فواتير المشتريات", prefix: "BILL", format: "{PREFIX}-{YEAR}-{SEQ:3}", counter: 4, example: "BILL-2026-004" },
                      { type: "عروض الأسعار", prefix: "Q", format: "{PREFIX}-{YEAR}-{SEQ:3}", counter: 5, example: "Q-2026-005" },
                      { type: "سندات القبض", prefix: "RV", format: "{PREFIX}-{YEAR}-{SEQ:3}", counter: 3, example: "RV-2026-003" },
                      { type: "سندات الدفع", prefix: "PV", format: "{PREFIX}-{YEAR}-{SEQ:3}", counter: 3, example: "PV-2026-003" },
                      { type: "الإشعارات الدائنة", prefix: "CN", format: "{PREFIX}-{YEAR}-{SEQ:3}", counter: 2, example: "CN-2026-002" },
                      { type: "قيود اليومية", prefix: "JE", format: "{PREFIX}-{SEQ:3}", counter: 4, example: "JE-004" },
                      { type: "المصروفات", prefix: "EXP", format: "{PREFIX}-{SEQ:3}", counter: 3, example: "EXP-003" },
                    ].map((doc) => (
                      <tr key={doc.type} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB]">
                        <td className="py-2.5 px-4" style={{ fontWeight: 500 }}>{doc.type}</td>
                        <td className="py-2.5 px-4"><Input defaultValue={doc.prefix} className="w-20 font-english text-xs" dir="ltr" /></td>
                        <td className="py-2.5 px-4 font-english text-xs text-[#6B7280]">{doc.format}</td>
                        <td className="py-2.5 px-4 font-english text-[#1276E3]" style={{ fontWeight: 600 }}>{doc.counter}</td>
                        <td className="py-2.5 px-4 font-english text-xs text-[#6B7280]">{doc.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] p-4 bg-[#F9FAFB]">
                <Shield className="h-5 w-5 text-[#F59E0B] shrink-0" />
                <div>
                  <p className="text-sm text-[#374151]" style={{ fontWeight: 600 }}>تنبيه ZATCA</p>
                  <p className="text-xs text-[#6B7280]">عداد الفواتير غير قابل لإعادة التعيين وفق متطلبات الهيئة. تعديل البادئة فقط متاح.</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>إعادة التعيين السنوي</Label>
                  <p className="text-sm text-[#6B7280]">إعادة تعيين العداد مع بداية كل سنة مالية (باستثناء فواتير المبيعات — ZATCA)</p>
                </div>
                <Switch />
              </div>

              <div className="flex justify-start"><Button className="bg-[#1276E3] hover:bg-[#1060C0]">حفظ الإعدادات</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: العملات ── */}
        <TabsContent value="currencies" className="space-y-4">
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]">إعدادات العملات</CardTitle>
              <CardDescription>العملة الأساسية وأسعار الصرف للتحويل التلقائي</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>العملة الأساسية</Label>
                  <div className="flex items-center gap-3 rounded-lg border-2 border-[#1276E3] bg-[#EFF6FF] p-4">
                    <span style={{ fontSize: "1.5rem" }}>🇸🇦</span>
                    <div>
                      <p className="text-[#0B1B49]" style={{ fontWeight: 700 }}>ريال سعودي (SAR)</p>
                      <p className="text-xs text-[#6B7280]">العملة الافتراضية لجميع المعاملات والتقارير</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>حساب فروق العملة</Label>
                  <select className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm focus:border-[#1276E3] focus:outline-none">
                    <option>6001 أرباح/خسائر فروق عملة</option>
                    <option>6002 أرباح فروق عملة محققة</option>
                  </select>
                  <p className="text-xs text-[#6B7280]">الحساب الذي تُسجل فيه فروق سعر الصرف تلقائياً</p>
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>أسعار الصرف</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#6B7280]">آخر تحديث: <span className="font-english">2026-03-04</span></span>
                    <Button variant="outline" size="sm" className="border-[#E5E7EB] text-xs">تحديث تلقائي</Button>
                  </div>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                        <th className="py-2.5 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>العملة</th>
                        <th className="py-2.5 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الرمز</th>
                        <th className="py-2.5 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>سعر الصرف (مقابل SAR)</th>
                        <th className="py-2.5 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>مفعّل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { flag: "🇺🇸", name: "دولار أمريكي", code: "USD", rate: "3.7500", active: true },
                        { flag: "🇪🇺", name: "يورو", code: "EUR", rate: "4.0650", active: true },
                        { flag: "🇬🇧", name: "جنيه إسترليني", code: "GBP", rate: "4.7200", active: true },
                        { flag: "🇦🇪", name: "درهم إماراتي", code: "AED", rate: "1.0210", active: true },
                        { flag: "🇪🇬", name: "جنيه مصري", code: "EGP", rate: "0.0760", active: false },
                        { flag: "🇯🇵", name: "ين ياباني", code: "JPY", rate: "0.0250", active: false },
                        { flag: "🇨🇳", name: "يوان صيني", code: "CNY", rate: "0.5150", active: false },
                        { flag: "🇮🇳", name: "روبية هندية", code: "INR", rate: "0.0445", active: false },
                      ].map((curr) => (
                        <tr key={curr.code} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB]">
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              <span>{curr.flag}</span>
                              <span style={{ fontWeight: 500 }}>{curr.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 font-english text-[#6B7280]">{curr.code}</td>
                          <td className="py-2.5 px-4">
                            <Input defaultValue={curr.rate} className="w-24 font-english text-xs" dir="ltr" />
                          </td>
                          <td className="py-2.5 px-4"><Switch defaultChecked={curr.active} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-4 bg-[#F9FAFB]">
                <div className="space-y-0.5">
                  <Label>تحديث أسعار الصرف تلقائياً</Label>
                  <p className="text-sm text-[#6B7280]">جلب أسعار الصرف من البنك المركزي السعودي (SAMA) يومياً</p>
                </div>
                <Switch />
              </div>

              <div className="flex justify-start"><Button className="bg-[#1276E3] hover:bg-[#1060C0]">حفظ الإعدادات</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: المستخدمين ── */}
        <TabsContent value="users" className="space-y-4">
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]">إدارة المستخدمين</CardTitle>
              <CardDescription>دعوة وإدارة أعضاء الفريق — 7 أدوار محددة مسبقاً</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: "طارق ملفي", email: "tareq@entix.io", role: "المالك", variant: "default" as const },
                  { name: "أحمد محمد", email: "ahmed@entix.io", role: "مدير", variant: "secondary" as const },
                  { name: "سارة علي", email: "sara@entix.io", role: "محاسب", variant: "secondary" as const },
                ].map((user) => (
                  <div key={user.email} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-4">
                    <div className="space-y-0.5">
                      <div className="text-[#0B1B49]" style={{ fontWeight: 500 }}>{user.name}</div>
                      <div className="text-sm text-[#6B7280] font-english">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={user.variant}>{user.role}</Badge>
                      <Button variant="outline" size="sm" className="border-[#E5E7EB]">تعديل</Button>
                    </div>
                  </div>
                ))}
                <Separator />
                <Button className="w-full bg-[#1276E3] hover:bg-[#1060C0]">
                  <Users className="me-2 h-4 w-4" />دعوة مستخدم جديد
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]">الأدوار المحددة مسبقاً</CardTitle>
              <CardDescription>7 أدوار مدمجة في النظام</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { role: "المالك (Owner)", desc: "صلاحيات كاملة + الفوترة" },
                  { role: "مدير (Admin)", desc: "صلاحيات كاملة ما عدا الفوترة" },
                  { role: "محاسب (Accountant)", desc: "المحاسبة والفواتير والتقارير" },
                  { role: "مدير مبيعات (Sales Manager)", desc: "إدارة المبيعات والعملاء" },
                  { role: "مدير مشتريات (Purchase Manager)", desc: "إدارة المشتريات والموردين" },
                  { role: "مدقق (Auditor)", desc: "قراءة فقط — التقارير والسجلات" },
                  { role: "موظف (Employee)", desc: "محدود: السجلات الشخصية فقط" },
                ].map((item, i, arr) => (
                  <div key={item.role}>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-[#0B1B49]">{item.role}</span>
                      <span className="text-xs text-[#6B7280]">{item.desc}</span>
                    </div>
                    {i < arr.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: التكاملات ── */}
        <TabsContent value="integrations">
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]">التكاملات الخارجية</CardTitle>
              <CardDescription>ربط Entix Books بالخدمات الخارجية</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* ZATCA */}
                <div className="flex items-center justify-between rounded-lg border-2 border-green-200 bg-green-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-green-600 p-2"><Shield className="h-5 w-5 text-white" /></div>
                    <div className="space-y-0.5">
                      <div className="text-[#0B1B49] font-english" style={{ fontWeight: 500 }}>ZATCA FATOORAH</div>
                      <div className="text-sm text-[#6B7280]">الفوترة الإلكترونية السعودية — المرحلة 1 + 2</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-600 text-white border-0">متصل</Badge>
                    <Button variant="outline" size="sm" className="border-[#E5E7EB]">إدارة</Button>
                  </div>
                </div>

                {/* Plaid */}
                <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-[#1276E3]/10 p-2"><CreditCard className="h-5 w-5 text-[#1276E3]" /></div>
                    <div className="space-y-0.5">
                      <div className="text-[#0B1B49] font-english" style={{ fontWeight: 500 }}>Plaid (Bank Feeds — US)</div>
                      <div className="text-sm text-[#6B7280]">ربط الحسابات البنكية الأمريكية للمطابقة التلقائية</div>
                    </div>
                  </div>
                  <Badge className="bg-[#F3E8FF] text-[#6B21A8] border-0">المرحلة 3</Badge>
                </div>

                {/* Open Banking */}
                <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-[#1276E3]/10 p-2"><Globe className="h-5 w-5 text-[#1276E3]" /></div>
                    <div className="space-y-0.5">
                      <div className="text-[#0B1B49] font-english" style={{ fontWeight: 500 }}>Open Banking (GCC)</div>
                      <div className="text-sm text-[#6B7280]">ربط الحسابات البنكية الخليجية</div>
                    </div>
                  </div>
                  <Badge className="bg-[#F3E8FF] text-[#6B21A8] border-0">المرحلة 3</Badge>
                </div>

                {/* Stripe */}
                <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-[#1276E3]/10 p-2"><CreditCard className="h-5 w-5 text-[#1276E3]" /></div>
                    <div className="space-y-0.5">
                      <div className="text-[#0B1B49] font-english" style={{ fontWeight: 500 }}>Stripe Payments</div>
                      <div className="text-sm text-[#6B7280]">معالجة المدفوعات عبر البطاقات</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">غير متصل</Badge>
                    <Button variant="outline" size="sm" className="border-[#E5E7EB]">ربط</Button>
                  </div>
                </div>

                {/* STC Pay */}
                <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-[#1276E3]/10 p-2"><CreditCard className="h-5 w-5 text-[#1276E3]" /></div>
                    <div className="space-y-0.5">
                      <div className="text-[#0B1B49] font-english" style={{ fontWeight: 500 }}>STC Pay / Mada</div>
                      <div className="text-sm text-[#6B7280]">المدفوعات المحلية السعودية</div>
                    </div>
                  </div>
                  <Badge variant="secondary">قريباً</Badge>
                </div>

                {/* Google Vision */}
                <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-[#1276E3]/10 p-2"><Shield className="h-5 w-5 text-[#1276E3]" /></div>
                    <div className="space-y-0.5">
                      <div className="text-[#0B1B49] font-english" style={{ fontWeight: 500 }}>Google Vision OCR</div>
                      <div className="text-sm text-[#6B7280]">قراءة الفواتير تلقائياً — AI</div>
                    </div>
                  </div>
                  <Badge className="bg-[#FCE7F3] text-[#9D174D] border-0">المرحلة 3</Badge>
                </div>

                {/* GOSI */}
                <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-[#1276E3]/10 p-2"><Shield className="h-5 w-5 text-[#1276E3]" /></div>
                    <div className="space-y-0.5">
                      <div className="text-[#0B1B49] font-english" style={{ fontWeight: 500 }}>GOSI Integration</div>
                      <div className="text-sm text-[#6B7280]">التأمينات الاجتماعية — حساب الاشتراكات تلقائياً</div>
                    </div>
                  </div>
                  <Badge className="bg-[#F3E8FF] text-[#6B21A8] border-0">المرحلة 2</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: الاشتراك ── */}
        <TabsContent value="billing">
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]">الاشتراك الحالي</CardTitle>
              <CardDescription>إدارة خطة اشتراكك ومدفوعاتك</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border-2 border-[#1276E3] bg-[#1276E3]/5 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>الخطة المتقدمة</h3>
                    <p className="text-[#6B7280] mt-1">
                      <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>149</span> SR / شهرياً
                    </p>
                  </div>
                  <Button className="bg-[#1276E3] hover:bg-[#1060C0]">ترقية الخطة</Button>
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-[#6B7280]">المستخدمين:</span><span className="me-2 font-english" style={{ fontWeight: 500 }}> 10</span></div>
                  <div><span className="text-[#6B7280]">الفواتير:</span><span className="me-2 font-english" style={{ fontWeight: 500 }}> 500</span> فاتورة/شهر</div>
                  <div><span className="text-[#6B7280]">تاريخ التجديد:</span><span className="me-2 font-english" style={{ fontWeight: 500 }}> 2026-04-04</span></div>
                  <div><span className="text-[#6B7280]">طريقة الدفع:</span><span className="me-2 font-english" style={{ fontWeight: 500 }}> Visa ****1234</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: الإشعارات ── */}
        <TabsContent value="notifications">
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]">إعدادات الإشعارات</CardTitle>
              <CardDescription>اختر الإشعارات التي تريد استلامها</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "إشعارات الفواتير", desc: "استلام إشعار عند إنشاء أو دفع فاتورة", on: true },
                { label: "تنبيهات الفواتير المتأخرة", desc: "تنبيه عند تأخر موعد استحقاق الفاتورة", on: true },
                { label: "تنبيهات حد الائتمان", desc: "تنبيه عند اقتراب عميل من حد الائتمان المحدد", on: true },
                { label: "تقارير أسبوعية", desc: "استلام ملخص أسبوعي للنشاط المالي", on: false },
                { label: "إشعارات البريد الإلكتروني", desc: "استلام الإشعارات عبر البريد الإلكتروني", on: true },
                { label: "تنبيهات ضريبة الاستقطاع", desc: "تنبيه عند وجود معاملات مع كيانات أجنبية تستوجب استقطاع", on: true },
                { label: "تنبيهات انتهاء الفترة المالية", desc: "تنبيه قبل موعد إقفال الفترة المالية", on: true },
              ].map((item, i, arr) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{item.label}</Label>
                      <p className="text-sm text-[#6B7280]">{item.desc}</p>
                    </div>
                    <Switch defaultChecked={item.on} />
                  </div>
                  {i < arr.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}