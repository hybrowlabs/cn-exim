// Copyright (c) 2025, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.query_reports["Material Request Report To Create Rfq And Po"] = {
	"filters": [
		{
			"fieldname": "material_request",
			"label": "Material Request",
			"fieldtype": "MultiSelectList",
			"options": "Material Request",
			"get_data": function (txt) {
				return frappe.db.get_link_options('Material Request', txt, { docstatus: 1 });
			}
		},
		{
			"fieldname": "item_code",
			"label": "Item Code",
			"fieldtype": "MultiSelectList",
			"options": "Item",
			"get_data": function (txt) {
				return frappe.db.get_link_options('Item', txt, { docstatus: 1 });
			}
		}
	],

	onload: function (report) {
		report.page.add_inner_button(__('Create RFQ'), function () {
			frappe.confirm('Are you sure you want to proceed to create RFQ?',
				function () {
					// When button is clicked, collect selected checkboxes
					let checked_items = [];
					$('.create-po-checkbox:checked').each(function () {
						checked_items.push({
							material_request: $(this).data('mr'),
							item_code: $(this).data('item-code'),
							qty: $(this).data('qty')
						});
					});

					if (checked_items.length === 0) {
						frappe.msgprint(__('Please select at least one Material Request.'));
						return;
					}

					frappe.call({
						method: "cn_exim.cn_exim.report.material_request_report_to_create_rfq_and_po.material_request_report_to_create_rfq_and_po.create_rfqs_from_simple_data",
						args: {
							items: checked_items
						},
						callback: function (r) {
							if (r.message) {
								frappe.msgprint({
									title: __('Request for Quotation Created'),
									message: "Request for Quotation Created Successfully! <br> ",
									// message: `Request for Quotation: <br> ${r.message.map(rfq_names => `<a href="/app/purchase-order/${rfq_names}" target="_blank"><b>${rfq_names}</b></a>`).join('<br>')}`,
									indicator: 'green'
								});
							}
						}
					});
				},
				function () {
					// User cancelled, do nothing
					frappe.msgprint(__('Action cancelled.'));
				}
			);
		});
		report.page.add_inner_button(__('Create Purchase Order'), function () {
			frappe.confirm('Are you sure you want to proceed to create Purchase Order?',
				function () {
					// When button is clicked, collect selected checkboxes
					let checked_items = [];
					$('.create-po-checkbox:checked').each(function () {
						checked_items.push({
							material_request: $(this).data('mr'),
							item_code: $(this).data('item-code'),
							qty: $(this).data('qty')
						});
					});

					if (checked_items.length === 0) {
						frappe.msgprint(__('Please select at least one Material Request.'));
						return;
					}

					frappe.call({
						method: "cn_exim.cn_exim.report.material_request_report_to_create_rfq_and_po.material_request_report_to_create_rfq_and_po.create_pos_from_simple_data",
						args: {
							items: checked_items
						},
						callback: function (r) {

							let mr_item_data = r.message[0];
							let company = r.message[1];

							let po = frappe.model.get_new_doc("Purchase Order");
							po.company = company
							po.naming_series = "PUR-ORD-.YYYY.-"
							po.title = "{supplier_name}"

							mr_item_data.forEach(function (item) {
								let row = frappe.model.add_child(po, "Purchase Order Item", "items");
								row.item_code = item.item_code;
								row.item_name = item.item_name;
								row.description = item.description;
								row.uom = item.uom;
								row.stock_uom = item.stock_uom;
								row.conversion_factor = item.conversion_factor;
								row.qty = item.qty - item.ordered_qty || 0; // Ensure qty is calculated correctly
								row.warehouse = item.warehouse;
								row.material_request = item.parent;
								row.material_request_item = item.name;
								row.schedule_date = frappe.datetime.nowdate();
							});

							// Redirect to the new PO form (optional)
							frappe.set_route("Form", "Purchase Order", po.name);

						}
					});
				},
				function () {
					// User cancelled, do nothing
					frappe.msgprint(__('Action cancelled.'));
				}
			);
		})
	},

	formatter: function (value, row, column, data, default_formatter) {
		if (column.fieldname === "create_po") {
			value = `<input type="checkbox" class="create-po-checkbox" 
				data-mr="${data.material_request}" 
				data-item-code="${data.item_code}"
				data-qty="${data.quantity}"
				>`
		}
		if (["item_code", "material_request"].includes(column.fieldname) && value) {

			// Build correct route for each DocType
			let route_map = {
				"item_code": "item",
				"material_request": "material-request",
			};

			let route = route_map[column.fieldname];

			return `<a href="/app/${route}/${value}" target="_blank">${value}</a>`;
		}
		return value;
	}
};
