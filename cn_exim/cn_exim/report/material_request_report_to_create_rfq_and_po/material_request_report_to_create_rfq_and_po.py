# Copyright (c) 2025, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe


def execute(filters=None):
	columns, data = get_columns(), get_data(filters)
	return columns, data


def get_columns():
        return [
			{"label": "Create PO", "fieldname": "create_po", "fieldtype": "Check", "width": 35},
			{"label": "Material Request", "fieldname": "material_request", "fieldtype": "Link", "options": "Material Request", "width": 200},
			{"label": "Item Code", "fieldname": "item_code", "fieldtype": "Link", "options": "Item", "width": 150},
			{"label": "UOM", "fieldname": "uom", "fieldtype": "Link", "options": "UOM", "width": 100},
			{"label": "Quantity", "fieldname": "quantity", "fieldtype": "Float", "width": 100},
		]
        
        
def get_data(filters):
    conditions = []
    values = {}

    if filters.get("material_request"):
        mr_list = frappe.parse_json(filters.get("material_request"))
        if isinstance(mr_list, str):
            mr_list = [mr.strip() for mr in mr_list.split(",")]
        conditions.append("mr.name IN %(material_request)s")
        values["material_request"] = mr_list
        
    if filters.get("item_code"):
        mr_list = frappe.parse_json(filters.get("item_code"))
        if isinstance(mr_list, str):
            mr_list = [mr.strip() for mr in mr_list.split(",")]
        conditions.append("mr_item.item_code IN %(item_code)s")
        values["item_code"] = mr_list

    condition_str = " AND " + " AND ".join(conditions) if conditions else ""

    query = f"""
        SELECT
            mr.name AS material_request,
            mr_item.item_code AS item_code,
            mr_item.uom AS uom,
            (mr_item.qty - (IFNULL(mr_item.ordered_qty, 0) + IFNULL(mr_item.custom_rfq_qty))) AS quantity
        FROM
            `tabMaterial Request Item` AS mr_item
        INNER JOIN
            `tabMaterial Request` AS mr ON mr.name = mr_item.parent
        WHERE
            mr.docstatus = 1 AND
            mr_item.custom_rfq_created = 0
            {condition_str}
    """

    data = frappe.db.sql(query, values, as_dict=True)
    return data




@frappe.whitelist()
def create_rfqs_from_simple_data(items):
    items = frappe.parse_json(items)
    supplier_items_map = {}

    for item in items:
        item_code = item.get("item_code")
        material_request = item.get("material_request")

        if not item_code or not material_request:
            continue

        # Get suppliers for this item
        suppliers = frappe.db.sql(
            """
            SELECT supplier 
            FROM `tabItem Supplier` 
            WHERE parent = %s
            """,
            (item_code,),
            as_dict=True,
        )
        

        # Fetch data from Material Request Item if necessary
        mri_data = {}

        if item.get("material_request_item"):
            mri_data = frappe.db.get_value(
                "Material Request Item",
                item.get("material_request_item"),
                [
                    "name", "uom", "item_name", "schedule_date", "description",
                    "item_group", "brand", "stock_uom", "conversion_factor", "warehouse"
                ],
                as_dict=True
            ) or {}
        else:
            mri_data = frappe.db.get_value(
                "Material Request Item",
                {"item_code": item_code, "parent": material_request},
                [
                    "name", "uom", "item_name", "schedule_date", "description",
                    "item_group", "brand", "stock_uom", "conversion_factor", "warehouse"
                ],
                as_dict=True
            ) or {}

        for supplier in suppliers:
            supplier_name = supplier.get("supplier")
            if not supplier_name:
                continue

            if supplier_name not in supplier_items_map:
                supplier_items_map[supplier_name] = []
                
                

            supplier_items_map[supplier_name].append({
                "item_code": item_code,
                "qty": item.get("qty") or 1,
                "uom": item.get("uom") or mri_data.get("uom") or "Nos",
                "material_request": material_request,
                "material_request_item": item.get("material_request_item") or mri_data.get("name"),
                "item_name": item.get("item_name") or mri_data.get("item_name"),
                "schedule_date": item.get("schedule_date") or mri_data.get("schedule_date"),
                "description": item.get("description") or mri_data.get("description"),
                "item_group": item.get("item_group") or mri_data.get("item_group"),
                "brand": item.get("brand") or mri_data.get("brand"),
                "stock_uom": item.get("stock_uom") or mri_data.get("stock_uom"),
                "conversion_factor": item.get("conversion_factor") or mri_data.get("conversion_factor"),
                "warehouse": item.get("warehouse") or mri_data.get("warehouse"),
            })

    rfq_names = []

    for supplier, item_list in supplier_items_map.items():
        material_request = item_list[0]["material_request"]

        # Check if RFQ already exists
        existing_rfq = frappe.db.sql(
            """
            SELECT DISTINCT rfq_supplier.parent 
            FROM `tabRequest for Quotation Supplier` rfq_supplier
            INNER JOIN `tabRequest for Quotation Item` rfq_item ON rfq_supplier.parent = rfq_item.parent
            INNER JOIN `tabRequest for Quotation` rfq ON rfq.name = rfq_supplier.parent
            WHERE rfq_supplier.supplier = %s AND rfq_item.material_request = %s AND rfq.docstatus != 2 AND rfq_supplier.parenttype = 'Request for Quotation'
            """,
            (supplier, material_request),
            as_dict=True,
        )
        

        if existing_rfq:
            frappe.msgprint(
				f"RFQ already exists for supplier {supplier} and material request {material_request}. Skipping RFQ creation."
			)
            continue

        # Create RFQ
        rfq = frappe.new_doc("Request for Quotation")
        rfq.append("suppliers", {"supplier": supplier})
        rfq.message_for_supplier = "Kindly quote your best rates for the following items."
        rfq.custom_type = "Material"
        rfq.custom_validity_start_date = frappe.utils.nowdate()
        rfq.custom_validity_end_date = frappe.utils.add_days(frappe.utils.nowdate(), 7)
        rfq.custom_quotation_deadline = frappe.utils.add_days(frappe.utils.nowdate(), 7)
        user = frappe.session.user
        employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
        if employee:
            rfq.custom_requestor_name = employee

        for item in item_list:
            rfq.append("items", {
                "item_code": item["item_code"],
                "qty": item["qty"],
                "uom": item["uom"],
                "material_request": item["material_request"],
                "material_request_item": item["material_request_item"],
                "item_name": item["item_name"],
                "schedule_date": item["schedule_date"],
                "description": item["description"],
                "item_group": item["item_group"],
                "brand": item["brand"],
                "stock_uom": item["stock_uom"],
                "conversion_factor": item["conversion_factor"],
                "warehouse": item["warehouse"],
            })
		
        rfq.insert()
        rfq_names.append(rfq.name)

    return {"rfqs": rfq_names}



@frappe.whitelist()
def create_pos_from_simple_data(items):
    items = frappe.json.loads(items)
    
    mr_item_list = []
    for item in items:
        mr_data =  frappe.db.get_value(
			"Material Request Item",
			{"parent": item.get("material_request"), "item_code": item.get("item_code")},
			["name", "uom", "item_code", "item_name", "schedule_date", "description", "item_group", "brand", "stock_uom", "conversion_factor", "warehouse", "qty", "rate", "parent", "ordered_qty"],
			as_dict=True
		) or {}
        
        
        mr_item_list.append(mr_data)
    company = frappe.get_value("Material Request", item.get("material_request"), "company")
    return mr_item_list, company