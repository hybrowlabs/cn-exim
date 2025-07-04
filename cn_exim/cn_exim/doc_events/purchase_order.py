import frappe

def on_trash(doc, method):
    # doc = frappe.json.loads(doc)
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
            frappe.db.set_value("Material Request Item", item.get("material_request_item"), "ordered_qty", order_qty)
            frappe.db.set_value("Material Request Item", item.get("material_request_item"), "custom_po_created", 0)
            
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
            updated_ordered_qty = current_ordered_qty - item.get("qty", 0)

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


