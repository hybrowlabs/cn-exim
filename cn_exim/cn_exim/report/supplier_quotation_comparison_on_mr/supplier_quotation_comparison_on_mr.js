// Copyright (c) 2025, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.query_reports["Supplier Quotation Comparison On Mr"] = {
	"filters": [
		{
			"fieldname": "material_request",
			"label": "Material Request",
			"fieldtype": "Link",
			"options": "Material Request",
			"reqd": 1
		},
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
		return value;
	},
};


