# import frappe
# from frappe.model.document import Document

# @frappe.whitelist()
# def create_rfqs(doc):
#     doc = frappe.parse_json(doc)
#     items = doc.get("items", [])

#     # Step 1: Build supplier-to-items mapping
#     supplier_items_map = {}

#     for item in items:
#         item_code = item.get("item_code")
#         if not item_code:
#             continue

#         suppliers = frappe.db.sql("""
#             SELECT supplier
#             FROM `tabItem Supplier`
#             WHERE parent = %s
#         """, (item_code,), as_dict=True)

#         for supplier in suppliers:
#             supplier_name = supplier.get("supplier")
#             if not supplier_name:
#                 continue

#             # Group items by supplier
#             if supplier_name not in supplier_items_map:
#                 supplier_items_map[supplier_name] = []

#             supplier_items_map[supplier_name].append({
#                 "item_code": item_code,
#                 "qty": item.get("qty") or 1,
#                 "uom": item.get("uom") or "Nos",
#                 "material_request": doc.get("name"),
#                 "material_request_item": item.get("name"),
#                 "item_name": item.get("item_name"),
#                 "schedule_date": item.get("schedule_date"),
#                 "description": item.get("description"),
#                 "item_group": item.get("item_group"),
#                 "brand": item.get("brand"),
#                 "stock_uom": item.get("stock_uom"),
#                 "conversion_factor": item.get("conversion_factor"),
#                 "warehouse": item.get("warehouse"),
#             })


#     # Step 2: Create one RFQ per supplier
#     rfq_names = []
#     for supplier, item_list in supplier_items_map.items():
#         rfq = frappe.new_doc("Request for Quotation")
#         rfq.schedule_date = doc.get("schedule_date")

#         rfq.append("suppliers", {
#             "supplier": supplier,
#         })

#         rfq.message_for_supplier = "Kindly quote your best rates for the following items."

#         for item in item_list:
#             rfq.append("items", {
#                 "item_code": item["item_code"],
#                 "qty": item["qty"],
#                 "uom": item["uom"],
#                 "material_request": item["material_request"],
#                 "material_request_item": item.get("material_request_item"),
#                 "item_name": item.get("item_name"),
#                 "schedule_date": item.get("schedule_date"),
#                 "description": item.get("description"),
#                 "item_group": item.get("item_group"),
#                 "brand":    item.get("brand"),
#                 "stock_uom": item.get("stock_uom"),
#                 "conversion_factor": item.get("conversion_factor"),
#                 "warehouse" : item.get("warehouse"),
#             })

#         rfq.insert()
#         rfq_names.append(rfq.name)

#     return {"rfqs": rfq_names}


import frappe
from frappe.model.document import Document


@frappe.whitelist()
def create_rfqs(doc):
    doc = frappe.parse_json(doc)
    items = doc.get("items", [])

    # Step 1: Build supplier-to-items mapping
    supplier_items_map = {}

    for item in items:
        item_code = item.get("item_code")
        if not item_code:
            continue

        suppliers = frappe.db.sql(
            """
            SELECT supplier 
            FROM `tabItem Supplier` 
            WHERE parent = %s
        """,
            (item_code,),
            as_dict=True,
        )

        for supplier in suppliers:
            supplier_name = supplier.get("supplier")
            if not supplier_name:
                continue

            # Group items by supplier
            if supplier_name not in supplier_items_map:
                supplier_items_map[supplier_name] = []

            supplier_items_map[supplier_name].append(
                {
                    "item_code": item_code,
                    "qty": item.get("qty") or 1,
                    "uom": item.get("uom") or "Nos",
                    "material_request": doc.get("name"),
                    "material_request_item": item.get("name"),
                    "item_name": item.get("item_name"),
                    "schedule_date": item.get("schedule_date"),
                    "description": item.get("description"),
                    "item_group": item.get("item_group"),
                    "brand": item.get("brand"),
                    "stock_uom": item.get("stock_uom"),
                    "conversion_factor": item.get("conversion_factor"),
                    "warehouse": item.get("warehouse"),
                }
            )

    # Step 2: Create one RFQ per supplier if not already existing
    rfq_names = []
    for supplier, item_list in supplier_items_map.items():
        # Check if RFQ already exists for this supplier and material request
        existing_rfq = frappe.db.sql(
            """
                SELECT DISTINCT rfq_supplier.parent 
                FROM `tabRequest for Quotation Supplier` rfq_supplier
                INNER JOIN `tabRequest for Quotation Item` rfq_item ON rfq_supplier.parent = rfq_item.parent
                WHERE rfq_supplier.supplier = %s AND rfq_item.material_request = %s AND rfq_supplier.parenttype = 'Request for Quotation'
            """,
            (supplier, doc.get("name")),
            as_dict=True,
        )

        if existing_rfq:
            continue

        # Create new RFQ
        rfq = frappe.new_doc("Request for Quotation")
        rfq.schedule_date = doc.get("schedule_date")

        rfq.append(
            "suppliers",
            {
                "supplier": supplier,
            },
        )

        rfq.message_for_supplier = (
            "Kindly quote your best rates for the following items."
        )

        for item in item_list:
            rfq.append(
                "items",
                {
                    "item_code": item["item_code"],
                    "qty": item["qty"],
                    "uom": item["uom"],
                    "material_request": item["material_request"],
                    "material_request_item": item.get("material_request_item"),
                    "item_name": item.get("item_name"),
                    "schedule_date": item.get("schedule_date"),
                    "description": item.get("description"),
                    "item_group": item.get("item_group"),
                    "brand": item.get("brand"),
                    "stock_uom": item.get("stock_uom"),
                    "conversion_factor": item.get("conversion_factor"),
                    "warehouse": item.get("warehouse"),
                },
            )

        rfq.insert()
        rfq_names.append(rfq.name)

    return {"rfqs": rfq_names}
