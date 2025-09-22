// Copyright (c) 2025, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.query_reports["Material Request Report To Create Rfq And Po"] = {
	"filters": [
		{
			fieldname: "docstatus",
			label: "Status",
			fieldtype: "Select",
			options: [
				{ label: "Manual Entry", value: "0" },
				{ label: "Submitted", value: "2" },
				{ label: "Approval Pending", value: "3"},
				{ label: "Approved", value: "1" }
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
		},
		{
			"fieldname": "company",
			"label": "Company",
			"fieldtype": "Link",
			"options": "Company"
		},
		{
			"fieldname": "show_workflow_state",
			"label": "Show Workflow State",
			"fieldtype": "Check",
			"hidden": 1,
			"default": 1
		}
	],

	onload: function (report) {
		// Auto-set company from user's employee
		frappe.call({
			method: "frappe.client.get_value",
			args: {
				doctype: "Employee",
				filters: {"user_id": frappe.session.user},
				fieldname: "company"
			},
			callback: function(r) {
				if (r.message && r.message.company) {
					frappe.query_report.set_filter_value("company", r.message.company);
				}
			}
		});

		setup_buttons(report);

		// Always hide the generic Actions dropdown on this report
		hide_actions_button();

		// Apply workflow filter rules on load
		apply_workflow_filter_rules();

		frappe.query_report.get_filter("docstatus").$input.on("change", function () {
			console.log("docstatus changed");
			setup_buttons(report);
			apply_workflow_filter_rules();
			frappe.query_report.refresh();
			hide_actions_button();
		});
		
		// Company filter change event
		frappe.query_report.get_filter("company").$input.on("change", function () {
			console.log("company changed");
			setup_buttons(report);
			hide_actions_button();
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
							<b>Supplier Name:</b> ${row.supplier_name || ""}<br>
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
		// Ensure single binding: remove previous handler before attaching
		$(document).off('click.editableQty', '.editable-mr-qty');
		$(document).on('click.editableQty', '.editable-mr-qty', function (e) {
        e.preventDefault();
        const mr = $(this).data('mr');
        const item_code = $(this).data('item');
        frappe.prompt(
            [
                {
                    fieldtype: 'Float',
                    label: 'Update Qty',
                    fieldname: 'update_qty',
                    reqd: 1,
                }
            ],
            function (values) {
                frappe.call({
                    method: "cn_exim.cn_exim.report.material_request_report_to_create_rfq_and_po.material_request_report_to_create_rfq_and_po.update_material_request_qty",
                    args: {
                        material_request: mr,
                        item_code: item_code,
                        qty: values.update_qty
                    },
                    callback: function (r) {
                        frappe.msgprint("Qty updated!");
                        frappe.query_report.refresh();
                    }
                });
            },
            'Write update qty',
            'Update'
        );
    });
	},

	// refresh: function(report) {
	// 	// This function is called every time the report refreshes
	// 	console.log("report refresh callback");
	// 	setup_buttons(report);
	// },

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
				data-mr-item-name="${data.mr_item_name}" 
				data-qty="${data.mr_qty}"
				>`;
		}
		if (["0", "2"].includes(frappe.query_report.get_filter_value("docstatus")) && column.fieldname === "mr_qty") {
			return `<a href="#" class="editable-mr-qty" data-mr="${data.material_request}" data-item="${data.item_code}">${value}</a>`;
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
}

// Auto-check and hide 'Show Workflow State' when docstatus = Submitted, hide for Draft and Approval Pending
function apply_workflow_filter_rules() {
    const docstatus = frappe.query_report.get_filter_value("docstatus");
    const showWf = frappe.query_report.get_filter("show_workflow_state");
    if (!showWf) return;

    if (docstatus === "1") {
        // Submitted: force checked and hide
        frappe.query_report.set_filter_value("show_workflow_state", 1);
        showWf.df.hidden = 1;
        showWf.refresh();
    } else {
        // Draft and Approval Pending: hide the checkbox completely
        showWf.df.hidden = 1;
        showWf.refresh();
    }
};

function setup_buttons(report) {
	report.page.clear_inner_toolbar();
	const docstatus = frappe.query_report.get_filter_value("docstatus");
	const company = frappe.query_report.get_filter_value("company");

	// Ensure Actions dropdown stays hidden even after toolbar rebuilds
	hide_actions_button();

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

	// Check role only for ELVENTIVE TECH PVT LTD company
	frappe.call({
		method: "cn_exim.cn_exim.report.material_request_report_to_create_rfq_and_po.material_request_report_to_create_rfq_and_po.check_user_buyer_role_for_elventive",
		args: {
			company: company
		},
		callback: function(r) {
			if (r.message) {
				let show_buttons = r.message.show_buttons;
				let has_buyer_role = r.message.has_buyer_role;
				setup_buttons_based_on_permission(report, docstatus, show_buttons);

				// If user has buyer role from Custom Settings (elev_buyer_role),
				// force docstatus to Approved and make it read-only
				const dsFilter = frappe.query_report.get_filter("docstatus");
				if (has_buyer_role) {
					frappe.query_report.set_filter_value("docstatus", "1");
					dsFilter.df.read_only = 1;
					dsFilter.refresh();
				} else {
					// Allow changing docstatus for non-buyer roles
					dsFilter.df.read_only = 0;
					dsFilter.refresh();
				}
			} else {
				setup_buttons_based_on_permission(report, docstatus, true);
				// Default: allow changing docstatus
				const dsFilter = frappe.query_report.get_filter("docstatus");
				dsFilter.df.read_only = 0;
				dsFilter.refresh();
			}
		}
	});
}

// Utility: hide standard Actions dropdown on Query Report
function hide_actions_button() {
	try {
		// Hide both the dropdown trigger and group if present
		$(".page-actions .actions-btn-group, .page-actions .btn-actions").hide();
	} catch (e) {
		// no-op
	}
}

function setup_buttons_based_on_permission(report, docstatus, show_buttons) {
	if (docstatus === "1") {
		// Only show RFQ and PO buttons if permission is granted
		if (show_buttons) {
			const docstatus = frappe.query_report.get_filter_value("docstatus");
			// docstatus.df.readonly =1;
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
							report.refresh();
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
						// report.refresh();
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
		}
	}else if (docstatus === "0") {
        // Check planner role for Submit Material Req button
        const company = frappe.query_report.get_filter_value("company");
        frappe.call({
            method: "cn_exim.cn_exim.report.material_request_report_to_create_rfq_and_po.material_request_report_to_create_rfq_and_po.check_user_planner_role_for_elventive",
            args: {
                company: company
            },
            callback: function(r) {
				console.log("r.message", r.message);
                if (r.message && r.message.show_buttons) {
					const docstatus = frappe.query_report.get_filter_value("docstatus");
					// docstatus.df.readonly =1;
                    // DRAFT: Submit Material Req logic (fully updated, passes mr_item_name!)
                    report.page.add_inner_button(__('Send for Approval'), function () {
            let checked_items = [];
            $('.create-po-checkbox:checked').each(function () {
                checked_items.push({
                    material_request: $(this).data('mr'),
                    mr_item_name: $(this).data('mr-item-name')
                });
            });

            if (checked_items.length === 0) {
                frappe.msgprint(__('Please select at least one Material Request.'));
                return;
            }

            let mr_map = {};
            checked_items.forEach(function(row){
                if (!mr_map[row.material_request]) mr_map[row.material_request] = [];
                mr_map[row.material_request].push(row.mr_item_name);
            });

            // Debug: See what's being passed
            console.log("Passing material requests for submit:", mr_map);

            frappe.call({
                method: "cn_exim.cn_exim.report.material_request_report_to_create_rfq_and_po.material_request_report_to_create_rfq_and_po.submit_selected_material_requests",
                args: { mr_selections: mr_map },
                callback: function (r) {
                    if (r.message && r.message.success_mrs && r.message.success_mrs.length) {
                        frappe.msgprint({
                            title: __("Material Requests Submitted"),
                            message: "Submitted: " + r.message.success_mrs.join(", "),
                            indicator: "green"
                        });
                    }
                    if (r.message && r.message.incomplete_mrs && r.message.incomplete_mrs.length) {
                        frappe.msgprint({
                            title: __("Could Not Submit"),
                            message: r.message.incomplete_mrs.join("<br>"),
                            indicator: "red"
                        });
                    }
                    frappe.query_report.refresh();
                }
            });
        });
                }
            }
        });
    } else if (docstatus === "2") {
        report.page.add_inner_button(__('Send for Approval'), function () {
            let checked_items = [];
            $('.create-po-checkbox:checked').each(function () {
                checked_items.push({
                    material_request: $(this).data('mr'),
                    mr_item_name: $(this).data('mr-item-name')
                });
            });

            if (checked_items.length === 0) {
                frappe.msgprint(__('Please select at least one Material Request.'));
                return;
            }

            let mr_map = {};
            checked_items.forEach(function(row){
                if (!mr_map[row.material_request]) mr_map[row.material_request] = [];
                mr_map[row.material_request].push(row.mr_item_name);
            });

            frappe.confirm('Are you sure you want to send these Material Requests for approval?', function () {
                frappe.call({
                    method: "cn_exim.cn_exim.report.material_request_report_to_create_rfq_and_po.material_request_report_to_create_rfq_and_po.send_for_approval",
                    args: { mr_selections: mr_map },
                    callback: function (r) {
                        if (r.message && r.message.success_mrs && r.message.success_mrs.length) {
                            frappe.msgprint({
                                title: __("Material Requests Sent for Approval"),
                                message: "Sent for approval: " + r.message.success_mrs.join(", "),
                                indicator: "green"
                            });
                        }
                        if (r.message && r.message.error_mrs && r.message.error_mrs.length) {
                            frappe.msgprint({
                                title: __("Could Not Send for Approval"),
                                message: r.message.error_mrs.join("<br>"),
                                indicator: "red"
                            });
                        }
                        frappe.query_report.refresh();
                    }
                });
            });
        });
    } else if (docstatus === "3") {
        report.page.add_inner_button(__('Go to Bulk Approval Page'), function () {
            let checked_items = [];
            $('.create-po-checkbox:checked').each(function () {
                checked_items.push({
                    material_request: $(this).data('mr'),
                    mr_item_name: $(this).data('mr-item-name')
                });
            });

            if (checked_items.length === 0) {
                frappe.msgprint(__('Please select at least one Material Request.'));
                return;
            }

            // Get unique Material Request IDs
            let mr_ids = [...new Set(checked_items.map(item => item.material_request))];
            
            // Get pending state from Custom Settings first, then navigate
            frappe.call({
                method: "frappe.client.get_value",
                args: {
                    doctype: "Custom Settings",
                    fieldname: "mr_to_po_pending_state"
                },
                callback: function(r) {
                    let pending_state = r.message ? r.message.mr_to_po_pending_state : null;
                    
                    // Navigate to Material Request list view with filters
                    frappe.route_options = {
                        "name": ["in", mr_ids]
                    };
                    
                    // Add workflow state filter if available
                    if (pending_state) {
                        frappe.route_options["workflow_state"] = pending_state;
                    }
                    
                    frappe.set_route("List", "Material Request");
                }
            });
        });
    }
}
