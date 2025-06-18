// Copyright (c) 2025, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.query_reports["Supplier Quotation Comparison On Mr"] = {
	"filters": [
		{
			"fieldname": "material_request",
			"label": "Material Request",
			"fieldtype": "Link",
			"options": "Material Request",
		},
		{
			"fieldname": "company",
			"label": "Company",
			"fieldtype": "Link",
			"options": "Company",
		},
		{
			"fieldname": "from_date",
			"label": "From Date",
			"fieldtype": "Date",
			"default": frappe.datetime.add_months(frappe.datetime.get_today(), -1),
		},
		{
			"fieldname": "to_date",
			"label": "To Date",
			"fieldtype": "Date",
			"default": frappe.datetime.get_today(),
		},
		{
			"fieldname": "item",
			"label": "Item",
			"fieldtype": "Link",
			"options": "Item",
			"get_query": function () {
				return {
					filters: {
						'is_stock_item': 1,
						'disabled': 0
					}
				};
			}
		},
		{
			"fieldname": "supplier",
			"label": "Supplier",
			"fieldtype": "Link",
			"options": "Supplier",
			"get_query": function () {
				return {
					filters: {
						'disabled': 0
					}
				};
			}
		},
		{
			"fieldname": "supplier_quotation",
			"label": "Supplier Quotation",
			"fieldtype": "Link",
			"options": "Supplier Quotation",
			"get_query": function () {
				return {
					filters: {
						'docstatus': 1, // Only show submitted quotations
						'status': ['in', ['Open', 'Submitted']],
					}
				};
			}
		},
		{
			"fieldname": "request_for_quotation",
			"label": "Request for Quotation",
			"fieldtype": "Link",
			"options": "Request for Quotation",
			"get_query": function () {
				return {
					filters: {
						'docstatus': 1, // Only show submitted RFQs
						'status': ['in', ['Open', 'Submitted']],
					}
				};
			}
		},
		{
			"fieldname": "include_expired",
			"label": "Include Expired",
			"fieldtype": "Check",
			"default": 0,
		}
	],

	// Add the top button
	onload: function (report) {
		report.page.add_inner_button(__('Create Purchase Orders'), function () {
			// When button is clicked, collect selected checkboxes
			let checked_items = [];
			$('.create-po-checkbox:checked').each(function () {
				checked_items.push({
					supplier_quotation: $(this).data('sq'),
					supplier: $(this).data('supplier'),
					item_code: $(this).data('item-code'),
					qty: $(this).data('qty')
				});
			});

			if (checked_items.length === 0) {
				frappe.msgprint(__('Please select at least one Supplier Quotation.'));
				return;
			}

			frappe.call({
				method: "cn_exim.cn_exim.report.supplier_quotation_comparison_on_mr.supplier_quotation_comparison_on_mr.create_purchase_orders",
				args: {
					items: checked_items
				},
				callback: function (r) {
					if (r.message) {
						frappe.msgprint({
							title: __('Purchase Orders Created'),
							message: `Created Purchase Orders: <br> ${r.message.map(po => `<a href="/app/purchase-order/${po}" target="_blank"><b>${po}</b></a>`).join('<br>')}`,
							indicator: 'green'
						});
					}
				}
			});
		});
	},
	after_datatable_render: function (datatable) {
		// Listen to changes on remarks input fields
		$(datatable.wrapper).find('.remarks-input').on('keyup change', function () {
			let supplier_quotation = $(this).data('sq');
			let supplier = $(this).data('supplier');
			let item_code = $(this).data('item-code');
			let remarks = $(this).val();

			// Call Frappe method to update the remarks in Supplier Quotation Item
			frappe.call({
				method: "cn_exim.cn_exim.report.supplier_quotation_comparison_on_mr.supplier_quotation_comparison_on_mr.update_remarks",
				args: {
					supplier_quotation: supplier_quotation,
					item_code: item_code,
					remarks: remarks
				},
				callback: function (r) {
					// Optionally show a small success or log message
					console.log(`Remarks updated for ${item_code} in ${supplier_quotation}`);
				}
			});
		});
	},


	formatter: function (value, row, column, data, default_formatter) {
		if (column.fieldname === "create_po") {
			value = `<input type="checkbox" class="create-po-checkbox" 
				data-sq="${data.supplier_quotation}" 
				data-supplier="${data.supplier}"
				data-item-code="${data.item_code}"
				data-qty="${data.quantity}"
				>`
		}
		if (column.fieldname === "remarks") {
			// Create editable text input
			value = `<input type="text" class="remarks-input" 
			data-row-index="${row}" 
			data-sq="${data.supplier_quotation}" 
			data-supplier="${data.supplier}"
			data-item-code="${data.item_code}" 
			value="${data.remarks || ''}" style="width: 100%;">`;
		}
		if (["supplier", "item_code", "supplier_quotation", "request_for_quotation", "material_request"].includes(column.fieldname) && value) {

            // Build correct route for each DocType
            let route_map = {
                "supplier": "supplier",
                "item_code": "item",
                "supplier_quotation": "supplier-quotation",
                "request_for_quotation": "request-for-quotation",
                "material_request": "material-request"
            };

            let route = route_map[column.fieldname];

            return `<a href="/app/${route}/${value}" target="_blank">${value}</a>`;
        }
		return value;
	},
};


