// Copyright (c) 2025, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.query_reports["Material Request Report To Create Rfq And Po"] = {
	"filters": [
		{
			fieldname: "docstatus",
			label: "Status",
			fieldtype: "Select",
			options: [
				{ label: "Draft", value: "0" },
				{ label: "Submitted", value: "1" }
			],
			default: "1"
		},
		{
			"fieldname": "material_request",
			"label": "Material Request",
			"fieldtype": "MultiSelectList",
			"options": "Material Request",
			"get_data": function (txt) {
				return frappe.db.get_link_options('Material Request', txt, {});
			}
		},
		{
			"fieldname": "item_code",
			"label": "Item Code",
			"fieldtype": "MultiSelectList",
			"options": "Item",
			"get_data": function (txt) {
				return frappe.db.get_link_options('Item', txt, {});
			}
		},
		{
			"fieldname": "transaction_date",
			"label": "Transaction Date",
			"fieldtype": "Date"
		}
	],

	onload: function (report) {
		setup_buttons(report);

		frappe.query_report.get_filter("docstatus").$input.on("change", function () {
			setup_buttons(report);
		});

		$(document).on('click', '.item-info-btn', function () {
			const item = $(this).data('item');

			frappe.call({
				method: "cn_exim.cn_exim.report.material_request_report_to_create_rfq_and_po.material_request_report_to_create_rfq_and_po.get_supplier_item_details",
				args: {
					item_code: item
				},
				callback: function (r) {
					if (r.message && r.message.data) {
						let suppliers = r.message.data.map(row => `
							<b>Supplier:</b> ${row.supplier}<br>
							<b>Min Order Qty:</b> ${row.custom_minimum_order_qty}<hr>
						`).join('');
						frappe.msgprint({
							title: `Supplier Info: ${item}`,
							message: suppliers,
							indicator: 'green'
						});
					} else if (r.message && r.message.message) {
						frappe.msgprint({
							title: `Supplier Info: ${item}`,
							message: r.message.message,
							indicator: 'orange'
						});
					}
				}
			});
		});
	},

	formatter: function (value, row, column, data, default_formatter) {
		if (column.fieldname === "quantity") {
			let color = "gray";
			if (value < 0) color = "red";
			else if (value > 0) color = "green";

			return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
		}
		if (column.fieldname === "item_info") {
			return `<button class="btn btn-xs btn-info item-info-btn" 
						data-mr="${data.material_request}" 
						data-item="${data.item_code}">
						<i class="fa fa-info"></i>
					</button>`;
		}
		if (column.fieldname === "create_po") {
			value = `<input type="checkbox" class="create-po-checkbox" 
				data-mr="${data.material_request}" 
				data-item-code="${data.item_code}"
				data-qty="${data.mr_qty}"
				>`;
		}
		if (["item_code", "material_request"].includes(column.fieldname) && value) {
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

function setup_buttons(report) {
	report.page.clear_inner_toolbar();
	const docstatus = frappe.query_report.get_filter_value("docstatus");

	let select_all_btn = report.page.add_inner_button(__('Select All'), function () {
		const checkboxes = $('.create-po-checkbox');
		let allChecked = true;
		checkboxes.each(function () {
			if (!$(this).prop('checked')) allChecked = false;
		});
		if (allChecked) {
			checkboxes.prop('checked', false);
			select_all_btn.html("Select All");
		} else {
			checkboxes.prop('checked', true);
			select_all_btn.html("Unselect All");
		}
	});

	if (docstatus === "1") {
		report.page.add_inner_button(__('Create RFQ'), function () {
			frappe.confirm('Are you sure you want to proceed to create RFQ?', function () {
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
					args: { items: checked_items },
					callback: function (r) {
						if (r.message) {
							frappe.msgprint({
								title: __('Request for Quotation Created'),
								message: "Request for Quotation Created Successfully!",
								indicator: 'green'
							});
						}
					}
				});
			});
		});

		report.page.add_inner_button(__('Create Purchase Order'), function () {
			frappe.confirm('Are you sure you want to proceed to create Purchase Order?', function () {
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
					args: { items: checked_items },
					callback: function (r) {
						let mr_item_data = r.message[0];
						let company = r.message[1];
						let po = frappe.model.get_new_doc("Purchase Order");
						po.company = company;
						po.naming_series = "PUR-ORD-.YYYY.-";
						po.title = "{supplier_name}";
						mr_item_data.forEach(function (item) {
							let row = frappe.model.add_child(po, "Purchase Order Item", "items");
							row.item_code = item.item_code;
							row.item_name = item.item_name;
							row.description = item.description;
							row.uom = item.uom;
							row.stock_uom = item.stock_uom;
							row.conversion_factor = item.conversion_factor;
							row.qty = item.qty - item.ordered_qty || 0;
							row.warehouse = item.warehouse;
							row.material_request = item.parent;
							row.material_request_item = item.name;
							row.schedule_date = frappe.datetime.nowdate();
						});
						frappe.set_route("Form", "Purchase Order", po.name);
					}
				});
			});
		});
	} else if (docstatus === "0") {
		report.page.add_inner_button(__('Submit Material Req'), function () {
			let checked_items = [];
			$('.create-po-checkbox:checked').each(function () {
				checked_items.push($(this).data('mr'));
			});
			if (checked_items.length === 0) {
				frappe.msgprint(__('Please select at least one Material Request.'));
				return;
			}
			// Deduplicate list
			let unique_mrs = [...new Set(checked_items)];
			frappe.call({
				method: "frappe.client.submit",
				args: {
					doc: {
						doctype: "Material Request",
						name: unique_mrs[0]
					}
				},
				callback: function () {
					frappe.msgprint("Material Request submitted successfully.");
					frappe.query_report.refresh();
				}
			});
		});
	}
}
