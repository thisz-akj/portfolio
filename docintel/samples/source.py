"""Synthetic sample documents for DocDesk (all companies, people and numbers are fictional).

Each document is a list of blocks rendered to PDF by scripts/build_samples.py, plus ground truth:
  fields   — the values extraction must return (Phase 2 tests / quality page)
  examples — pre-written questions with answers and the exact quotes that support them. These are
             served without calling a model, and each quote must be found in the parsed PDF (tested).
Block kinds: ("title", s) ("sub", s) ("h", s) ("p", s) ("small", s) ("table", rows, widths) ("kv", rows)
             ("sign", [(name, role, company), ...]) ("space", pts)
"""

from __future__ import annotations

ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def gstin(body14: str) -> str:
    """Appends the GSTIN check character (mod-36 algorithm) so sample GSTINs are valid."""
    total = 0
    for i, ch in enumerate(body14):
        p = ALPHABET.index(ch) * (1 if i % 2 == 0 else 2)
        total += p // 36 + p % 36
    return body14 + ALPHABET[(36 - total % 36) % 36]


def inr(n: float) -> str:
    """Indian digit grouping: 217356 → 2,17,356.00"""
    whole, frac = f"{n:.2f}".split(".")
    head, tail = whole[:-3], whole[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return ",".join([*groups, tail]) + "." + frac


GST_NORTHWIND = gstin("29AABCN4821F1Z")
GST_SAFFRON = gstin("29AAKFS7310K1Z")
GST_KAVERI = gstin("33AACCK9054M1Z")
GST_KESTREL = gstin("29AAFCK2267P1Z")

# ---------------------------------------------------------------------------------------------
# Master services agreement — v1 (signed) and v2 (counter-party redline) share one template.
# ---------------------------------------------------------------------------------------------

MSA_TERMS = {
    "v1": dict(
        date="1 April 2026", status="Executed", term="twenty-four (24) months", renew_notice="sixty (60) days",
        retainer="4,50,000", pay_days="thirty (30) days", interest="one and a half percent (1.5%) per month",
        increase="eight percent (8%)", uptime="99.5%", credit_cap="ten percent (10%)", breach_hours="seventy-two (72) hours",
        conf_years="three (3) years", cap_months="twelve (12) months", cure="thirty (30) days",
        conv_notice="sixty (60) days", city="Bengaluru", state="Karnataka", nonsolicit="twelve (12) months",
    ),
    "v2": dict(
        date="15 September 2026", status="Draft for negotiation — Northwind redline", term="thirty-six (36) months",
        renew_notice="ninety (90) days", retainer="4,50,000", pay_days="forty-five (45) days",
        interest="one percent (1%) per month", increase="ten percent (10%)", uptime="99.5%", credit_cap="five percent (5%)",
        breach_hours="forty-eight (48) hours", conf_years="three (3) years", cap_months="six (6) months", cure="thirty (30) days",
        conv_notice="ninety (90) days", city="Mumbai", state="Maharashtra", nonsolicit="twenty-four (24) months",
    ),
}


def msa(version: str) -> list:
    t = MSA_TERMS[version]
    blocks: list = [
        ("title", "Master Services Agreement"),
        ("sub", f"Agreement No. KA/MSA/2026/014 · Effective Date: {t['date']} · {t['status']}"),
        ("p", "This Master Services Agreement (the \"Agreement\") is entered into on the Effective Date between "
              "Kestrel Analytics Private Limited, a company incorporated under the Companies Act, 2013, having its "
              "registered office at 3rd Floor, Lakeview Tech Park, Koramangala, Bengaluru 560034 (the \"Provider\"), and "
              "Northwind Distributors Private Limited, having its registered office at No. 18, Peenya Industrial Area, "
              "Phase II, Bengaluru 560058 (the \"Customer\"). The Provider and the Customer are each a \"Party\"."),
        ("h", "1. Definitions"),
        ("p", "1.1 \"Services\" means the data engineering, analytics and reporting services described in each Statement "
              "of Work executed under this Agreement."),
        ("p", "1.2 \"Deliverables\" means the reports, dashboards, data pipelines and documentation created by the "
              "Provider specifically for the Customer under a Statement of Work."),
        ("p", "1.3 \"Confidential Information\" means any non-public business, technical or financial information "
              "disclosed by one Party to the other, in any form, that is marked confidential or would reasonably be "
              "understood to be confidential."),
        ("h", "2. Scope of Services"),
        ("p", "2.1 The Provider shall perform the Services in a professional manner, with qualified personnel, and in "
              "accordance with each Statement of Work. In case of conflict, this Agreement prevails over a Statement of "
              "Work unless the Statement of Work expressly states otherwise."),
        ("p", "2.2 The Customer shall provide timely access to its systems, data and personnel reasonably required "
              "for the Provider to perform the Services."),
        ("h", "3. Term and Renewal"),
        ("p", f"3.1 This Agreement commences on the Effective Date and continues for an initial term of {t['term']} "
              f"(the \"Initial Term\"). Thereafter it renews automatically for successive twelve (12) month terms "
              f"unless either Party gives written notice of non-renewal at least {t['renew_notice']} before the end of "
              f"the then-current term."),
        ("h", "4. Service Levels"),
        ("p", f"4.1 The Provider shall make the hosted reporting portal available {t['uptime']} of the time in each "
              f"calendar month, excluding scheduled maintenance notified at least forty-eight (48) hours in advance."),
        ("p", f"4.2 If availability falls below the committed level, the Customer is entitled to service credits as set "
              f"out in Schedule B, capped at {t['credit_cap']} of the monthly retainer for the affected month. Service "
              f"credits are the Customer's sole remedy for availability failures."),
        ("h", "5. Fees and Payment"),
        ("p", f"5.1 The Customer shall pay a monthly retainer of INR {t['retainer']} (Indian Rupees) plus applicable "
              f"GST, and any additional fees set out in a Statement of Work."),
        ("p", f"5.2 The Provider shall invoice monthly in advance. Undisputed invoices are payable within "
              f"{t['pay_days']} of the invoice date."),
        ("p", f"5.3 Late payments carry interest at {t['interest']} on the overdue amount from the due date until the "
              f"date of payment."),
        ("p", f"5.4 The Provider may increase its fees on renewal by giving sixty (60) days' written notice, provided "
              f"that any increase does not exceed {t['increase']} of the fees in the preceding term."),
        ("h", "6. Confidentiality"),
        ("p", "6.1 Each Party shall keep the other Party's Confidential Information confidential, use it only to perform "
              "or receive the Services, and disclose it only to employees and advisers who need to know it and are "
              "bound by similar obligations."),
        ("p", f"6.2 The obligations in this Section 6 survive for {t['conf_years']} after the expiry or termination of "
              f"this Agreement."),
        ("h", "7. Intellectual Property"),
        ("p", "7.1 Upon full payment of the applicable fees, all rights in the Deliverables vest in the Customer. The "
              "Provider retains ownership of its pre-existing tools, libraries and know-how, and grants the Customer a "
              "non-exclusive, perpetual licence to use them as embedded in the Deliverables."),
        ("h", "8. Data Protection"),
        ("p", "8.1 Each Party shall comply with the Digital Personal Data Protection Act, 2023 and the rules made under "
              "it. The Provider shall process personal data only on the Customer's documented instructions."),
        ("p", f"8.2 The Provider shall notify the Customer of any personal data breach without undue delay and in any "
              f"event within {t['breach_hours']} of becoming aware of it."),
        ("h", "9. Warranties"),
        ("p", "9.1 The Provider warrants that the Services will be performed with reasonable skill and care and that "
              "the Deliverables will materially conform to the applicable Statement of Work for ninety (90) days after "
              "delivery. Except as stated in this Agreement, all other warranties are excluded."),
        ("h", "10. Limitation of Liability"),
        ("p", f"10.1 Each Party's total aggregate liability arising out of or in connection with this Agreement shall "
              f"not exceed the total fees paid by the Customer in the {t['cap_months']} preceding the event giving rise "
              f"to the claim."),
        ("p", "10.2 Neither Party is liable for any indirect, incidental, special or consequential loss, or for loss of "
              "profits, revenue or goodwill. The limits in this Section 10 do not apply to breach of Section 6, a "
              "Party's indemnity obligations, or liability for fraud or wilful misconduct."),
        ("h", "11. Termination"),
        ("p", f"11.1 Either Party may terminate this Agreement for cause if the other Party commits a material breach "
              f"and fails to cure it within {t['cure']} of receiving written notice describing the breach."),
        ("p", f"11.2 Either Party may terminate this Agreement for convenience upon {t['conv_notice']}' written notice "
              f"to the other Party."),
        ("p", "11.3 On termination, the Customer shall pay for all Services performed up to the effective date of "
              "termination, and each Party shall return or destroy the other Party's Confidential Information."),
        ("h", "12. Governing Law and Disputes"),
        ("p", f"12.1 This Agreement is governed by the laws of India. Subject to Section 12.2, the courts at "
              f"{t['city']}, {t['state']} have exclusive jurisdiction."),
        ("p", f"12.2 Any dispute shall be referred to arbitration by a sole arbitrator under the Arbitration and "
              f"Conciliation Act, 1996. The seat and venue of arbitration shall be {t['city']} and the language shall "
              f"be English."),
        ("h", "13. Non-Solicitation"),
        ("p", f"13.1 During the term and for {t['nonsolicit']} after it ends, neither Party shall directly solicit for "
              f"employment any employee of the other Party who was involved in the Services, without prior written "
              f"consent."),
    ]
    if version == "v2":
        blocks += [
            ("h", "14. Subcontracting"),
            ("p", "14.1 The Provider shall not subcontract any part of the Services without the Customer's prior "
                  "written consent, and remains responsible for the acts and omissions of its subcontractors."),
        ]
    blocks += [
        ("h", "15. General" if version == "v2" else "14. General"),
        ("p", "This Agreement, together with its Schedules and Statements of Work, is the entire agreement between "
              "the Parties on its subject matter. Any amendment must be in writing and signed by both Parties. "
              "Notices must be sent by email with a copy by registered post to the addresses above."),
        ("space", 14),
        ("sign", [("Ananya Rao", "Director", "Kestrel Analytics Private Limited"),
                  ("Vikram Shetty", "Chief Financial Officer", "Northwind Distributors Private Limited")]),
    ]
    return blocks


def msa_fields(version: str) -> dict:
    v1 = version == "v1"
    return {
        "parties": ["Kestrel Analytics Private Limited", "Northwind Distributors Private Limited"],
        "effective_date": "2026-04-01" if v1 else "2026-09-15",
        "initial_term_months": 24 if v1 else 36,
        "auto_renewal": True,
        "renewal_notice_days": 60 if v1 else 90,
        "payment_terms_days": 30 if v1 else 45,
        "monthly_fee_inr": 450000,
        "liability_cap": "Fees paid in the preceding 12 months" if v1 else "Fees paid in the preceding 6 months",
        "termination_convenience_notice_days": 60 if v1 else 90,
        "governing_law": "India",
        "jurisdiction_city": "Bengaluru" if v1 else "Mumbai",
        "breach_notification_hours": 72 if v1 else 48,
    }


# ---------------------------------------------------------------------------------------------
# Invoices and purchase order — numbers are computed so the arithmetic is honest, except where a
# defect is planted on purpose (Kaveri invoice: grand total typo, qty/price/payment-term drift).
# ---------------------------------------------------------------------------------------------

def _lines(items):
    return [(d, hsn, q, r, q * r) for d, hsn, q, r in items]


INV1_ITEMS = _lines([
    ("Stainless steel water bottle, 750 ml", "7323", 240, 310),
    ("Insulated lunch box, 3-tier", "3924", 120, 455),
    ("Kitchen storage jar set (6 pcs)", "3924", 80, 690),
])
INV1_SUB = sum(l[4] for l in INV1_ITEMS)
INV1_TAX = round(INV1_SUB * 0.09)
INV1_TOTAL = INV1_SUB + 2 * INV1_TAX

PO_ITEMS = _lines([
    ("Cast iron tawa, 12 inch", "7321", 150, 640),
    ("Pressure cooker, 5 litre", "7615", 60, 1850),
    ("Non-stick fry pan, 24 cm", "7615", 100, 720),
])
PO_SUB = sum(l[4] for l in PO_ITEMS)
PO_TAX = round(PO_SUB * 0.18)
PO_TOTAL = PO_SUB + PO_TAX

INV2_ITEMS = _lines([
    ("Cast iron tawa, 12 inch", "7321", 150, 640),
    ("Pressure cooker, 5 litre", "7615", 72, 1850),
    ("Non-stick fry pan, 24 cm", "7615", 100, 745),
])
INV2_SUB = sum(l[4] for l in INV2_ITEMS)
INV2_TAX = round(INV2_SUB * 0.18)
INV2_TOTAL_TRUE = INV2_SUB + INV2_TAX
INV2_TOTAL_PRINTED = 358636  # transposed digits — the true total is 3,58,366


def _item_table(items, tax_cols: list[tuple[str, int]], total: int, words: str) -> list:
    rows = [["#", "Description", "HSN", "Qty", "Rate (₹)", "Amount (₹)"]]
    for i, (d, hsn, q, r, amt) in enumerate(items, 1):
        rows.append([str(i), d, hsn, str(q), inr(r), inr(amt)])
    sub = sum(l[4] for l in items)
    rows.append(["", "Taxable value", "", "", "", inr(sub)])
    for label, amount in tax_cols:
        rows.append(["", label, "", "", "", inr(amount)])
    rows.append(["", "Grand total", "", "", "", inr(total)])
    return [("table", rows, [22, 200, 45, 35, 75, 90]), ("p", f"Amount in words: {words}")]


INVOICE_1 = [
    ("title", "Tax Invoice"),
    ("kv", [["Invoice No.", "NWD/2026-27/0418", "Invoice date", "12 October 2026"],
            ["Place of supply", "Karnataka (29)", "Due date", "11 November 2026"]]),
    ("h", "Supplier"),
    ("p", f"Northwind Distributors Private Limited, No. 18, Peenya Industrial Area, Phase II, Bengaluru 560058. "
          f"GSTIN: {GST_NORTHWIND}"),
    ("h", "Bill to"),
    ("p", f"Saffron Retail LLP, 44 Commercial Street, Bengaluru 560001. GSTIN: {GST_SAFFRON}"),
    ("space", 6),
    *_item_table(INV1_ITEMS, [("CGST @ 9%", INV1_TAX), ("SGST @ 9%", INV1_TAX)], INV1_TOTAL,
                 "Rupees Two Lakh Seventeen Thousand Three Hundred Fifty-Six Only"),
    ("h", "Payment terms"),
    ("p", "Net 30 days from the invoice date. Bank: HDFC Bank, Peenya branch, A/c No. 50200071234567, IFSC HDFC0001782. "
          "Interest at 18% per annum applies to payments received after the due date."),
    ("small", "This is a computer-generated invoice. Goods once sold will be taken back only as per the returns policy."),
]

PURCHASE_ORDER = [
    ("title", "Purchase Order"),
    ("kv", [["PO No.", "SRL/PO/2026/0932", "PO date", "1 October 2026"],
            ["Deliver by", "20 October 2026", "Payment terms", "Net 45 days from receipt of goods"]]),
    ("h", "Buyer"),
    ("p", f"Saffron Retail LLP, 44 Commercial Street, Bengaluru 560001. GSTIN: {GST_SAFFRON}"),
    ("h", "Vendor"),
    ("p", f"Kaveri Kitchenware Private Limited, Plot 7, SIDCO Industrial Estate, Coimbatore 641021. GSTIN: {GST_KAVERI}"),
    ("space", 6),
    *_item_table(PO_ITEMS, [("IGST @ 18%", PO_TAX)], PO_TOTAL,
                 "Rupees Three Lakh Twenty-Nine Thousand Two Hundred Twenty Only"),
    ("h", "Terms"),
    ("p", "Deliver to Saffron Retail warehouse, Hosur Road, Bengaluru 560068. Quantities above the ordered quantity "
          "will not be accepted without a revised PO. Prices are fixed for this order. Quote the PO number on every "
          "invoice and delivery challan."),
    ("small", "Approved by: Meera Iyer, Purchase Manager, Saffron Retail LLP"),
]

INVOICE_2 = [
    ("title", "Tax Invoice"),
    ("kv", [["Invoice No.", "KKP/2026-27/1187", "Invoice date", "18 October 2026"],
            ["Buyer PO No.", "SRL/PO/2026/0932", "Place of supply", "Karnataka (29)"]]),
    ("h", "Supplier"),
    ("p", f"Kaveri Kitchenware Private Limited, Plot 7, SIDCO Industrial Estate, Coimbatore 641021. GSTIN: {GST_KAVERI}"),
    ("h", "Bill to"),
    ("p", f"Saffron Retail LLP, 44 Commercial Street, Bengaluru 560001. GSTIN: {GST_SAFFRON}"),
    ("space", 6),
    *_item_table(INV2_ITEMS, [("IGST @ 18%", INV2_TAX)], INV2_TOTAL_PRINTED,
                 "Rupees Three Lakh Fifty-Eight Thousand Six Hundred Thirty-Six Only"),
    ("h", "Payment terms"),
    ("p", "Net 30 days from the invoice date. Bank: State Bank of India, Coimbatore Main, A/c No. 38912204451, "
          "IFSC SBIN0000881."),
    ("small", "Certified that the particulars given above are true and correct. For Kaveri Kitchenware Pvt. Ltd. — "
              "Authorised Signatory"),
]

# ---------------------------------------------------------------------------------------------
NDA = [
    ("title", "Mutual Non-Disclosure Agreement"),
    ("sub", "Effective Date: 3 August 2026"),
    ("p", "This Mutual Non-Disclosure Agreement is made between Northwind Distributors Private Limited, Bengaluru "
          "(\"Northwind\") and Lumen Freight Solutions Private Limited, Chennai (\"Lumen\"), each a \"Party\"."),
    ("h", "1. Purpose"),
    ("p", "1.1 The Parties wish to evaluate a possible logistics partnership for last-mile delivery in South India "
          "(the \"Purpose\") and may disclose Confidential Information to each other for that Purpose only."),
    ("h", "2. Confidential Information"),
    ("p", "2.1 \"Confidential Information\" means all information disclosed by a Party, whether oral, written or "
          "electronic, including pricing, customer lists, route data, volumes and business plans."),
    ("p", "2.2 Confidential Information does not include information that (a) is or becomes public through no fault "
          "of the receiving Party, (b) was lawfully known to the receiving Party before disclosure, (c) is received "
          "from a third party without restriction, or (d) is independently developed without use of the disclosing "
          "Party's information."),
    ("h", "3. Obligations"),
    ("p", "3.1 The receiving Party shall use Confidential Information only for the Purpose, protect it with at least "
          "reasonable care, and disclose it only to its employees and advisers who need to know it."),
    ("p", "3.2 Disclosure required by law or a court order is permitted if the receiving Party gives prompt written "
          "notice (where legally allowed) so the disclosing Party may seek protection."),
    ("h", "4. Term"),
    ("p", "4.1 This Agreement lasts two (2) years from the Effective Date. The confidentiality obligations survive for "
          "three (3) years after this Agreement expires or is terminated."),
    ("h", "5. Return of Information"),
    ("p", "5.1 On written request, the receiving Party shall return or destroy all Confidential Information within "
          "fifteen (15) days and confirm this in writing."),
    ("h", "6. No Licence or Obligation"),
    ("p", "6.1 No licence to any intellectual property is granted by this Agreement. Neither Party is obliged to "
          "enter into any further agreement."),
    ("h", "7. Remedies and Governing Law"),
    ("p", "7.1 Each Party acknowledges that breach may cause irreparable harm and that the disclosing Party may seek "
          "injunctive relief in addition to any other remedy."),
    ("p", "7.2 This Agreement is governed by the laws of India and the courts at Bengaluru, Karnataka have exclusive "
          "jurisdiction."),
    ("space", 14),
    ("sign", [("Vikram Shetty", "Chief Financial Officer", "Northwind Distributors Private Limited"),
              ("Rahul Menon", "Managing Director", "Lumen Freight Solutions Private Limited")]),
]

LEASE = [
    ("title", "Lease Deed — Office Premises"),
    ("sub", "Executed at Bengaluru on 12 December 2025"),
    ("p", "This Lease Deed is made between Indigo Park Realty LLP, a limited liability partnership with its office at "
          "Indigo Park, Outer Ring Road, Bellandur, Bengaluru 560103 (the \"Lessor\"), and Northwind Distributors "
          "Private Limited (the \"Lessee\")."),
    ("h", "1. Premises"),
    ("p", "1.1 The Lessor leases to the Lessee Unit 402, Fourth Floor, Tower B, Indigo Park, Outer Ring Road, "
          "Bellandur, Bengaluru 560103, admeasuring 3,200 square feet of carpet area (the \"Premises\"), together with "
          "four (4) covered car parking spaces."),
    ("h", "2. Term and Lock-in"),
    ("p", "2.1 The lease is for sixty (60) months commencing 1 January 2026 (the \"Commencement Date\")."),
    ("p", "2.2 The first twenty-four (24) months are a lock-in period. If the Lessee terminates during the lock-in "
          "period, it shall pay the rent for the remaining part of the lock-in period."),
    ("p", "2.3 After the lock-in period, the Lessee may terminate this lease by giving three (3) months' written "
          "notice. The Lessor may terminate only for breach as set out in Clause 9."),
    ("h", "3. Rent"),
    ("p", "3.1 The monthly rent is INR 1,85,000 (Rupees One Lakh Eighty-Five Thousand) plus GST, payable in advance "
          "on or before the 7th day of each month."),
    ("p", "3.2 The rent shall increase by five percent (5%) on completion of every twelve (12) months from the "
          "Commencement Date."),
    ("p", "3.3 The Lessee is granted a rent-free fit-out period of forty-five (45) days from the Commencement Date. "
          "Maintenance charges are payable during the fit-out period."),
    ("p", "3.4 Rent not paid by the due date carries interest at eighteen percent (18%) per annum until paid."),
    ("h", "4. Security Deposit"),
    ("p", "4.1 The Lessee has paid an interest-free refundable security deposit of INR 11,10,000 (Rupees Eleven Lakh "
          "Ten Thousand), equal to six (6) months' rent."),
    ("p", "4.2 The Lessor shall refund the deposit within thirty (30) days of the Lessee handing over vacant "
          "possession, after deducting any unpaid dues and the cost of repairing damage beyond normal wear and tear."),
    ("h", "5. Maintenance and Utilities"),
    ("p", "5.1 The Lessee shall pay common area maintenance charges at INR 18 per square foot of carpet area per "
          "month, revised annually at actuals. Electricity and water are billed to the Lessee as per separate meters."),
    ("h", "6. Use and Alterations"),
    ("p", "6.1 The Premises shall be used only as an office. The Lessee may carry out non-structural interior works "
          "with prior written approval, which the Lessor shall not unreasonably withhold."),
    ("h", "7. Repairs"),
    ("p", "7.1 Structural repairs, the building's lifts, fire systems and common areas are the Lessor's "
          "responsibility. Day-to-day repairs inside the Premises are the Lessee's responsibility."),
    ("h", "8. Insurance"),
    ("p", "8.1 The Lessor shall insure the building. The Lessee shall insure its own fit-outs, equipment and "
          "contents."),
    ("h", "9. Default"),
    ("p", "9.1 If the Lessee fails to pay rent for two (2) consecutive months, or materially breaches this deed and "
          "does not remedy it within thirty (30) days of notice, the Lessor may terminate this lease."),
    ("h", "10. Stamp Duty and Registration"),
    ("p", "10.1 Stamp duty and registration charges for this deed shall be borne by the Lessee."),
    ("h", "11. Governing Law"),
    ("p", "11.1 This deed is governed by the laws of India, and the courts at Bengaluru shall have jurisdiction."),
    ("space", 14),
    ("sign", [("Karthik Gowda", "Designated Partner", "Indigo Park Realty LLP"),
              ("Vikram Shetty", "Chief Financial Officer", "Northwind Distributors Private Limited")]),
]

LEAVE_POLICY = [
    ("title", "Leave Policy"),
    ("sub", "Northwind Distributors Private Limited · Version 3.2 · Effective 1 April 2026 · Owner: Human Resources"),
    ("h", "1. Scope"),
    ("p", "1.1 This policy applies to all permanent employees in India. Contract staff are covered by their contract "
          "terms. The leave year runs from 1 April to 31 March."),
    ("h", "2. Earned Leave"),
    ("p", "2.1 Employees earn eighteen (18) days of earned leave per year, accrued at 1.5 days per completed month of "
          "service."),
    ("p", "2.2 Unused earned leave may be carried forward up to a maximum balance of forty-five (45) days. Earned "
          "leave of up to fifteen (15) days can be encashed at the basic salary rate when the employee leaves the "
          "company."),
    ("p", "2.3 Earned leave of more than three (3) days must be applied for in the HR portal at least seven (7) days "
          "in advance."),
    ("h", "3. Casual Leave"),
    ("p", "3.1 Employees receive eight (8) days of casual leave per year, credited on 1 April. Casual leave cannot be "
          "carried forward or encashed, and cannot exceed three (3) consecutive days."),
    ("h", "4. Sick Leave"),
    ("p", "4.1 Employees receive ten (10) days of sick leave per year. A medical certificate is required for sick "
          "leave of more than two (2) consecutive days."),
    ("h", "5. Parental Leave"),
    ("p", "5.1 Maternity leave is twenty-six (26) weeks with full pay, as per the Maternity Benefit Act, 1961, for "
          "the first two children."),
    ("p", "5.2 Paternity leave is ten (10) working days with full pay, to be taken within three (3) months of the "
          "birth or adoption of a child."),
    ("h", "6. Other Leave"),
    ("p", "6.1 Bereavement leave of five (5) days is available on the death of an immediate family member."),
    ("p", "6.2 The company observes twelve (12) public holidays and allows two (2) optional holidays per year from "
          "the published list."),
    ("h", "7. Probation"),
    ("p", "7.1 Employees on probation accrue earned leave from their joining date but may use it only after "
          "confirmation. Casual and sick leave are available during probation on a pro-rata basis."),
    ("h", "8. Leave Without Pay"),
    ("p", "8.1 Absence beyond the available leave balance is treated as leave without pay and requires the approval "
          "of the reporting manager and Human Resources."),
]

# ---------------------------------------------------------------------------------------------

DOCUMENTS = [
    {
        "id": "msa-kestrel-v1",
        "title": "Master Services Agreement — Kestrel × Northwind",
        "type": "contract",
        "blurb": "Signed analytics services agreement (v1).",
        "blocks": msa("v1"),
        "fields": msa_fields("v1"),
        "examples": [
            {"q": "What's the termination notice period, and does it auto-renew?",
             "a": "Either party can terminate for convenience on 60 days' written notice. Yes, it auto-renews for "
                  "successive 12-month terms unless notice of non-renewal is given at least 60 days before the term ends.",
             "quotes": ["terminate this Agreement for convenience upon sixty (60) days' written notice",
                        "renews automatically for successive twelve (12) month terms"]},
            {"q": "How much is the liability cap?",
             "a": "Total liability is capped at the fees the Customer paid in the 12 months before the event behind "
                  "the claim. The cap doesn't apply to confidentiality breaches, indemnities, fraud or wilful misconduct.",
             "quotes": ["shall not exceed the total fees paid by the Customer in the twelve (12) months preceding",
                        "The limits in this Section 10 do not apply to breach of Section 6"]},
            {"q": "When are invoices due and what if they're paid late?",
             "a": "Undisputed invoices are due within 30 days of the invoice date. Late payments carry interest of "
                  "1.5% per month on the overdue amount.",
             "quotes": ["payable within thirty (30) days of the invoice date",
                        "Late payments carry interest at one and a half percent (1.5%) per month"]},
            {"q": "Who pays for the office coffee?",
             "a": None, "quotes": []},
        ],
    },
    {
        "id": "msa-kestrel-v2",
        "title": "Master Services Agreement — Northwind redline (v2)",
        "type": "contract",
        "blurb": "Counter-party draft of the same MSA. Compare it with v1.",
        "blocks": msa("v2"),
        "fields": msa_fields("v2"),
        "examples": [
            {"q": "Where would disputes be heard under this draft?",
             "a": "Disputes go to arbitration by a sole arbitrator seated in Mumbai, and the courts at Mumbai, "
                  "Maharashtra have exclusive jurisdiction.",
             "quotes": ["The seat and venue of arbitration shall be Mumbai",
                        "the courts at Mumbai, Maharashtra have exclusive jurisdiction"]},
            {"q": "Can the provider use subcontractors?",
             "a": "Only with the Customer's prior written consent, and the Provider stays responsible for its "
                  "subcontractors.",
             "quotes": ["shall not subcontract any part of the Services without the Customer's prior written consent"]},
        ],
    },
    {
        "id": "invoice-northwind-0418",
        "title": "Tax Invoice NWD/2026-27/0418",
        "type": "invoice",
        "blurb": "Intra-state GST invoice, Northwind → Saffron Retail.",
        "blocks": INVOICE_1,
        "fields": {
            "invoice_number": "NWD/2026-27/0418", "invoice_date": "2026-10-12", "due_date": "2026-11-11",
            "supplier_name": "Northwind Distributors Private Limited", "supplier_gstin": GST_NORTHWIND,
            "buyer_name": "Saffron Retail LLP", "buyer_gstin": GST_SAFFRON, "place_of_supply": "Karnataka (29)",
            "line_items": [{"description": d, "hsn": h, "qty": q, "rate": r, "amount": a} for d, h, q, r, a in INV1_ITEMS],
            "taxable_value": INV1_SUB, "cgst": INV1_TAX, "sgst": INV1_TAX, "igst": 0, "total": INV1_TOTAL,
            "payment_terms_days": 30,
        },
        "examples": [
            {"q": "What is the total payable and when is it due?",
             "a": f"₹{inr(INV1_TOTAL)} including CGST and SGST at 9% each, due on 11 November 2026 (Net 30).",
             "quotes": [f"Grand total {inr(INV1_TOTAL)}", "11 November 2026"]},
            {"q": "What's the supplier's GSTIN?",
             "a": f"{GST_NORTHWIND} (Northwind Distributors Private Limited).",
             "quotes": [f"GSTIN: {GST_NORTHWIND}"]},
        ],
    },
    {
        "id": "po-saffron-0932",
        "title": "Purchase Order SRL/PO/2026/0932",
        "type": "purchase_order",
        "blurb": "Saffron Retail's order to Kaveri Kitchenware.",
        "blocks": PURCHASE_ORDER,
        "fields": {
            "po_number": "SRL/PO/2026/0932", "po_date": "2026-10-01", "deliver_by": "2026-10-20",
            "buyer_name": "Saffron Retail LLP", "buyer_gstin": GST_SAFFRON,
            "vendor_name": "Kaveri Kitchenware Private Limited", "vendor_gstin": GST_KAVERI,
            "line_items": [{"description": d, "hsn": h, "qty": q, "rate": r, "amount": a} for d, h, q, r, a in PO_ITEMS],
            "taxable_value": PO_SUB, "igst": PO_TAX, "total": PO_TOTAL, "payment_terms_days": 45,
        },
        "examples": [
            {"q": "How many pressure cookers were ordered and at what price?",
             "a": "60 pressure cookers (5 litre) at ₹1,850.00 each, ₹1,11,000.00 in total.",
             "quotes": ["Pressure cooker, 5 litre 7615 60 1,850.00 1,11,000.00"]},
        ],
    },
    {
        "id": "invoice-kaveri-1187",
        "title": "Tax Invoice KKP/2026-27/1187",
        "type": "invoice",
        "blurb": "Kaveri's invoice against the PO. Something doesn't add up.",
        "blocks": INVOICE_2,
        "fields": {
            "invoice_number": "KKP/2026-27/1187", "invoice_date": "2026-10-18", "po_number": "SRL/PO/2026/0932",
            "supplier_name": "Kaveri Kitchenware Private Limited", "supplier_gstin": GST_KAVERI,
            "buyer_name": "Saffron Retail LLP", "buyer_gstin": GST_SAFFRON, "place_of_supply": "Karnataka (29)",
            "line_items": [{"description": d, "hsn": h, "qty": q, "rate": r, "amount": a} for d, h, q, r, a in INV2_ITEMS],
            "taxable_value": INV2_SUB, "cgst": 0, "sgst": 0, "igst": INV2_TAX, "total": INV2_TOTAL_PRINTED,
            "payment_terms_days": 30,
        },
        "known_issues": [
            f"Grand total printed as {inr(INV2_TOTAL_PRINTED)}; taxable value + IGST = {inr(INV2_TOTAL_TRUE)}",
            "Pressure cooker quantity 72 vs 60 on the PO",
            "Fry pan rate 745.00 vs 720.00 on the PO",
            "Payment terms Net 30 vs Net 45 on the PO",
        ],
        "examples": [
            {"q": "Which purchase order is this invoice against?",
             "a": "Purchase order SRL/PO/2026/0932.",
             "quotes": ["SRL/PO/2026/0932"]},
        ],
    },
    {
        "id": "nda-lumen",
        "title": "Mutual NDA — Northwind × Lumen Freight",
        "type": "contract",
        "blurb": "Two-way NDA for a logistics partnership.",
        "blocks": NDA,
        "fields": {
            "parties": ["Northwind Distributors Private Limited", "Lumen Freight Solutions Private Limited"],
            "effective_date": "2026-08-03", "initial_term_months": 24, "confidentiality_survival_years": 3,
            "return_within_days": 15, "governing_law": "India", "jurisdiction_city": "Bengaluru",
        },
        "examples": [
            {"q": "How long do the confidentiality obligations last?",
             "a": "The NDA runs for 2 years from 3 August 2026, and confidentiality obligations survive for 3 more "
                  "years after it ends.",
             "quotes": ["This Agreement lasts two (2) years from the Effective Date",
                        "survive for three (3) years after this Agreement expires or is terminated"]},
        ],
    },
    {
        "id": "lease-indigo-park",
        "title": "Office Lease — Indigo Park, Bellandur",
        "type": "lease",
        "blurb": "Five-year office lease with a lock-in and escalation.",
        "blocks": LEASE,
        "fields": {
            "lessor": "Indigo Park Realty LLP", "lessee": "Northwind Distributors Private Limited",
            "premises": "Unit 402, Fourth Floor, Tower B, Indigo Park, Bellandur, Bengaluru 560103",
            "area_sqft": 3200, "commencement_date": "2026-01-01", "term_months": 60, "lock_in_months": 24,
            "monthly_rent_inr": 185000, "escalation_percent": 5, "security_deposit_inr": 1110000,
            "notice_after_lock_in_months": 3, "rent_free_days": 45,
        },
        "examples": [
            {"q": "Can we leave before the lock-in ends, and what would it cost?",
             "a": "You can, but terminating during the 24-month lock-in means paying rent for the rest of the "
                  "lock-in period. After the lock-in you can leave on 3 months' written notice.",
             "quotes": ["it shall pay the rent for the remaining part of the lock-in period",
                        "terminate this lease by giving three (3) months' written notice"]},
            {"q": "How much is the deposit and when do we get it back?",
             "a": "₹11,10,000 (six months' rent), interest-free, refunded within 30 days of handing over vacant "
                  "possession, less unpaid dues and damage repairs.",
             "quotes": ["refundable security deposit of INR 11,10,000",
                        "refund the deposit within thirty (30) days of the Lessee handing over vacant possession"]},
        ],
    },
    {
        "id": "leave-policy",
        "title": "Leave Policy v3.2 — Northwind",
        "type": "policy",
        "blurb": "HR leave policy: entitlements, carry-forward, parental leave.",
        "blocks": LEAVE_POLICY,
        "fields": {
            "version": "3.2", "effective_date": "2026-04-01", "earned_leave_days": 18, "carry_forward_max_days": 45,
            "casual_leave_days": 8, "sick_leave_days": 10, "maternity_weeks": 26, "paternity_days": 10,
        },
        "examples": [
            {"q": "How much paternity leave do I get?",
             "a": "10 working days with full pay, to be taken within 3 months of the birth or adoption.",
             "quotes": ["Paternity leave is ten (10) working days with full pay"]},
            {"q": "Can I carry forward casual leave?",
             "a": "No. Casual leave can't be carried forward or encashed. Only earned leave carries forward, up to a "
                  "45-day balance.",
             "quotes": ["Casual leave cannot be carried forward or encashed",
                        "carried forward up to a maximum balance of forty-five (45) days"]},
        ],
    },
]

# ---------------------------------------------------------------------------------------------
# Golden questions for the quality report (scripts/evaluate.py). `expect`: every group must appear in the
# answer (a group is "a|b" = any of); `section`: a citation must come from it; `negative`: the right answer is
# "not in the document". Phrased the way people ask, not the way the documents are written.
# ---------------------------------------------------------------------------------------------
GOLDEN = [
    # MSA v1
    {"doc": "msa-kestrel-v1", "q": "How much notice do we need to give to end this contract without cause?", "expect": ["60|sixty"], "section": "11. Termination"},
    {"doc": "msa-kestrel-v1", "q": "Does the agreement renew on its own?", "expect": ["12|twelve", "renew"], "section": "3. Term and Renewal"},
    {"doc": "msa-kestrel-v1", "q": "What's the monthly retainer?", "expect": ["4,50,000|450000|4.5 lakh"], "section": "5. Fees and Payment"},
    {"doc": "msa-kestrel-v1", "q": "What interest is charged on late payments?", "expect": ["1.5"], "section": "5. Fees and Payment"},
    {"doc": "msa-kestrel-v1", "q": "Who owns the deliverables?", "expect": ["customer"], "section": "7. Intellectual Property"},
    {"doc": "msa-kestrel-v1", "q": "What uptime does the provider commit to?", "expect": ["99.5"], "section": "4. Service Levels"},
    {"doc": "msa-kestrel-v1", "q": "Which city's courts have jurisdiction?", "expect": ["bengaluru|bangalore"], "section": "12. Governing Law and Disputes"},
    {"doc": "msa-kestrel-v1", "q": "Is there a penalty for missing delivery deadlines?", "negative": True},
    {"doc": "msa-kestrel-v1", "q": "What is the provider's office phone number?", "negative": True},
    # MSA v2
    {"doc": "msa-kestrel-v2", "q": "How long is the initial term?", "expect": ["36|thirty-six"], "section": "3. Term and Renewal"},
    {"doc": "msa-kestrel-v2", "q": "Within how many hours must a personal data breach be reported?", "expect": ["48|forty-eight"], "section": "8. Data Protection"},
    {"doc": "msa-kestrel-v2", "q": "What's the cap on service credits?", "expect": ["5%|five percent|5 percent"], "section": "4. Service Levels"},
    {"doc": "msa-kestrel-v2", "q": "How many days do we have to pay an invoice?", "expect": ["45|forty-five"], "section": "5. Fees and Payment"},
    # Invoice 1
    {"doc": "invoice-northwind-0418", "q": "How much CGST is charged?", "expect": ["16,578|16578"]},
    {"doc": "invoice-northwind-0418", "q": "How many lunch boxes were billed and at what rate?", "expect": ["120", "455"]},
    {"doc": "invoice-northwind-0418", "q": "Which bank account should we pay into?", "expect": ["hdfc", "50200071234567"]},
    {"doc": "invoice-northwind-0418", "q": "Is there a discount for early payment?", "negative": True},
    # PO
    {"doc": "po-saffron-0932", "q": "When must the goods be delivered?", "expect": ["20 october|20 oct|2026-10-20"]},
    {"doc": "po-saffron-0932", "q": "Where should the vendor deliver?", "expect": ["hosur"]},
    {"doc": "po-saffron-0932", "q": "Who approved this purchase order?", "expect": ["meera"]},
    # Invoice 2
    {"doc": "invoice-kaveri-1187", "q": "What is the supplier's IFSC code?", "expect": ["sbin0000881"]},
    {"doc": "invoice-kaveri-1187", "q": "How many pressure cookers are on this invoice?", "expect": ["72"]},
    {"doc": "invoice-kaveri-1187", "q": "What is the e-way bill number?", "negative": True},
    # NDA
    {"doc": "nda-lumen", "q": "What is the purpose of sharing information under this NDA?", "expect": ["logistics|last-mile"], "section": "1. Purpose"},
    {"doc": "nda-lumen", "q": "How quickly must information be returned on request?", "expect": ["15|fifteen"], "section": "5. Return of Information"},
    {"doc": "nda-lumen", "q": "Does the NDA grant any licence to IP?", "expect": ["no"], "section": "6. No Licence or Obligation"},
    # Lease
    {"doc": "lease-indigo-park", "q": "How many parking spaces come with the office?", "expect": ["4|four"], "section": "1. Premises"},
    {"doc": "lease-indigo-park", "q": "Who pays the stamp duty?", "expect": ["lessee"], "section": "10. Stamp Duty and Registration"},
    {"doc": "lease-indigo-park", "q": "maintenance charges kitne hain?", "expect": ["18"], "section": "5. Maintenance and Utilities"},
    {"doc": "lease-indigo-park", "q": "Can we sublet part of the office?", "negative": True},
    # Policy
    {"doc": "leave-policy", "q": "How many sick days do employees get?", "expect": ["10|ten"], "section": "4. Sick Leave"},
    {"doc": "leave-policy", "q": "When do I need a medical certificate?", "expect": ["2|two"], "section": "4. Sick Leave"},
    {"doc": "leave-policy", "q": "Can probationers use earned leave?", "expect": ["confirm"], "section": "7. Probation"},
    {"doc": "leave-policy", "q": "How many days of sabbatical can I take?", "negative": True},
    # Paraphrases (few or no shared words) and answers that must be worked out from the clauses.
    {"doc": "msa-kestrel-v1", "q": "Can we walk away from this deal early without giving a reason?", "expect": ["60|sixty"], "section": "11. Termination"},
    {"doc": "msa-kestrel-v1", "q": "If Kestrel leaks our customer data, how soon must they tell us?", "expect": ["72|seventy-two"], "section": "8. Data Protection"},
    {"doc": "msa-kestrel-v1", "q": "Can Kestrel poach our analysts?", "expect": ["12|twelve"], "section": "13. Non-Solicitation"},
    {"doc": "msa-kestrel-v1", "q": "By when must we send a non-renewal notice to stop the first automatic renewal?", "expect": ["2028"], "section": "3. Term and Renewal"},
    {"doc": "lease-indigo-park", "q": "If we move out after 12 months, what's the financial hit?", "expect": ["lock-in|remaining"], "section": "2. Term and Lock-in"},
    {"doc": "lease-indigo-park", "q": "What will the monthly rent be in the third year?", "expect": ["203962|203963|2.04"], "section": "3. Rent"},
    {"doc": "leave-policy", "q": "My wife is due next month, how much time off can I take?", "expect": ["10|ten"], "section": "5. Parental Leave"},
    {"doc": "invoice-northwind-0418", "q": "What's the total GST on this bill?", "expect": ["33156"]},
]
