# Dashboard and navigation pattern

The company dashboard answers three questions in one view: what is owed, how the selected period performed, and what needs attention. Do not introduce a second dashboard for the same company by switching between saved documents and posted books.

- Current receivables, payables and recorded bank balances are independent of the performance period. Display their as-of date and currency. Never add foreign currencies without an established conversion basis.
- Performance uses the API's stated source and selected dates. Drafts are separate document activity, not profit. Missing or unavailable metrics remain unavailable rather than zero.
- Keep posting gaps and their review action visible. A comparison of totals is not a bank reconciliation or journal audit.
- Show one primary trend and an actionable follow-up list. Use `DetailSection` for document registers, advanced charts and historical references. Keep exact-date report links available.
- Reuse shared `Card`, `Button`, product page headers/toolbars, semantic color tokens and logical start/end spacing. Do not create a new font, palette or status convention per page.
- Sidebar route expansion is temporary. Only explicit expansion/collapse choices persist. Collapsing groups never removes routes or search results.

For further page consolidation, preserve focused tasks (invoice editing, reconciliation and reports) instead of putting every form into the dashboard. Apply the same summary → action → details hierarchy to their existing layouts, with Arabic/English, phone/tablet/desktop, empty/error and long-content checks before rollout.

Research: [Xero sales overview](https://central.xero.com/0/article/Sales-dashboard), [QuickBooks mobile business dashboard](https://quickbooks.intuit.com/learn-support/en-ca/help-article/product-setup/business-dashboard-details-quickbooks-online-app/L46DORrt9_CA_en_CA), [Wave cash flow](https://support.waveapps.com/hc/en-us/articles/360041235832-View-and-understand-your-cash-flow-statement), [Zoho Books home](https://www.zoho.com/en-sg/books/help/home/). These inform information hierarchy, not accounting calculations.
