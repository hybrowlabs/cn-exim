import frappe


@frappe.whitelist()
def get_stage_status(purchase_order_name):
    """Fetch connection status for each stage."""
    status = {
        "pickup_request": False,
        "rfq": False,
        "supplier_quotation": False,
        "pre_alert": False,
        "pre_alert_checklist": False,
        "bill_of_entry": False,
        "eway_bill": False,
        "po_update": False,
        "purchase_receipt": False,
        "purchase_invoice": False
    }

    # Example: Check if Pickup Request exists
    if frappe.db.exists("Purchase Order List", {"po_number": purchase_order_name}):
        status["pickup_request"] = True

    # Check other stages similarly
    if frappe.db.exists("Request for Quotation", {"purchase_order": purchase_order_name}):
        status["rfq"] = True

    # if frappe.db.exists("Supplier Quotation", {"purchase_order": purchase_order_name}):
    #     status["supplier_quotation"] = True
    

    return status


@frappe.whitelist()
def get_extra_charge_template(name):
    data = frappe.db.sql(" select * from `tabItem Charges Template` where  parent=%s ",(name), as_dict=True)
    
    return data

@frappe.whitelist()
def update_material_request_item(doc):
    doc = frappe.json.loads(doc)
    
    for item in doc.get("items", []):
        material_request_item = item.get("material_request_item")
        if material_request_item:
            data = frappe.db.get_value(
                "Material Request Item",
                material_request_item,
                ["qty", "ordered_qty"],
                as_dict=True
            )
            
        
            order_qty = float(data.ordered_qty) - float(item.get("qty", 0))
            if order_qty < 0:
                order_qty = 0
            frappe.db.set_value("Material Request Item", material_request_item, "ordered_qty", order_qty)
            frappe.db.set_value("Material Request Item", material_request_item, "custom_po_created", 0)
        
            removed_qty = float(item.get("qty", 0))

            # Step 1: Get all Supplier Quotation Items linked to the material_request_item
            sq_items = frappe.get_all(
                "Supplier Quotation Item",
                filters={"material_request_item": material_request_item},
                fields=["name", "custom_ordered_qty"]
            )

            if not sq_items:
                continue

            # Step 2: Calculate the new ordered_qty (same for all linked SQ Items)
            # Assume using the first one to calculate current ordered_qty
            current_ordered_qty = float(sq_items[0].custom_ordered_qty or 0)
            updated_ordered_qty = current_ordered_qty - removed_qty

            if updated_ordered_qty < 0:
                updated_ordered_qty = 0

            # Step 3: Update all linked SQ Items with the new ordered_qty
            for sq in sq_items:
                frappe.db.set_value(
                    "Supplier Quotation Item",
                    sq.name,
                    "custom_ordered_qty",
                    updated_ordered_qty
                )
        if not material_request_item or removed_qty <= 0:
            continue






@frappe.whitelist()
def update_material_request_to_po_created(doc):
    doc = frappe.parse_json(doc)

    if doc.get("items"):
        for item in doc.get("items"):
            material_request_item = item.get("material_request_item")

            if material_request_item:
                # Get sum of PO qtys for this material_request_item where PO is draft or submitted
                result = frappe.db.sql("""
                    SELECT SUM(qty) as total_qty
                    FROM `tabPurchase Order Item`
                    WHERE material_request_item = %s
                    AND parent IN (
                        SELECT name FROM `tabPurchase Order` WHERE docstatus IN (0, 1)
                    )
                """, (material_request_item,), as_dict=True)

                total_ordered_qty = result[0].total_qty or 0

                # Get MR qty
                mr_data = frappe.db.get_value(
                    "Material Request Item",
                    material_request_item,
                    ["qty"],
                    as_dict=True
                )

                if mr_data:
                    mr_qty = mr_data.qty or 0

                    # Update ordered_qty
                    frappe.db.set_value("Material Request Item", material_request_item, "ordered_qty", total_ordered_qty)

                    # Set flag: 1 if total_ordered_qty >= mr_qty, else 0
                    frappe.db.set_value(
                        "Material Request Item",
                        material_request_item,
                        "custom_po_created",
                        1 if float(total_ordered_qty) >= float(mr_qty) else 0
                    )





@frappe.whitelist()
def update_material_request_qty(removed_items):
    removed_items = frappe.json.loads(removed_items) if isinstance(removed_items, str) else removed_items
    if not removed_items:
        return

    for item in removed_items:
        material_request_item = item.get("material_request_item")
        po_qty = float(item.get("qty", 0))

        if material_request_item:
            mr_item = frappe.get_doc("Material Request Item", material_request_item)
            current_ordered_qty = mr_item.ordered_qty or 0
            material_request_qty = mr_item.qty or 0
            

            updated_ordered_qty = current_ordered_qty - po_qty
            if updated_ordered_qty < 0:
                updated_ordered_qty = 0

            mr_item.ordered_qty = updated_ordered_qty
            mr_item.custom_po_created = 0
            mr_item.save(ignore_permissions=True)
            
            
@frappe.whitelist()
def update_supplier_quotation_item(doc):
    doc = frappe.parse_json(doc)

    for item in doc.get("items", []):
        material_request_item = item.get("material_request_item")
        supplier_quotation_item = item.get("supplier_quotation_item")
        if not material_request_item:
            continue

        # Step 1: Find all Supplier Quotation Items linked to this material_request_item
        sq_items = frappe.get_all(
            "Supplier Quotation Item",
            filters={"material_request_item": material_request_item},
            fields=["name"]
        )

        if not sq_items:
            continue

        # Step 2: Pick one to calculate total PO qty (since all are same material_request_item)

        result = frappe.db.sql("""
            SELECT SUM(qty) AS total_qty
            FROM `tabPurchase Order Item`
            WHERE supplier_quotation_item = %s
            AND parent IN (
                SELECT name FROM `tabPurchase Order`
                WHERE docstatus IN (0, 1)
            )
        """, (supplier_quotation_item,), as_dict=True)

        total_ordered_qty = result[0].total_qty or 0

        # Step 3: Update all SQ items linked to same material_request_item
        for sq in sq_items:
            frappe.db.set_value(
                "Supplier Quotation Item",
                sq.name,
                "custom_ordered_qty",
                total_ordered_qty
            )

