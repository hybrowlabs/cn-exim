frappe.ui.form.on('Work Order', {
    refresh: function(frm) {
        // Add Create Quality Inspection button
        if (frm.doc.status !== "Cancelled") {
            frm.add_custom_button(__('Create Quality Inspection'), function() {
                create_quality_inspections_for_all_stock_entries(frm);
            }, __('Create')).addClass('btn-primary');
        }
        
        // Set up shelf filter based on warehouse
        setup_shelf_filter(frm);
    },
    
    custom_target_warehouse: function(frm) {
        // Update shelf options when warehouse changes
        update_shelf_options(frm);
    }
});

function setup_shelf_filter(frm) {
    // Set up the shelf field with warehouse filter
    if (frm.get_field('custom_target_shelf')) {
        frm.get_field('custom_target_shelf').get_query = function() {
            return {
                filters: {
                    'warehouse': frm.doc.custom_target_warehouse || ''
                }
            };
        };
    }
}

function update_shelf_options(frm) {
    // Clear shelf value when warehouse changes
    if (frm.doc.custom_target_warehouse) {
        frm.set_value('custom_target_shelf', '');
        
        // Refresh the shelf field to update options
        if (frm.get_field('custom_target_shelf')) {
            frm.get_field('custom_target_shelf').refresh();
        }
    }
}

function create_quality_inspections_for_all_stock_entries(frm) {
    // Get Stock Entries for this Work Order
    frappe.call({
        method: "cn_exim.config.py.quality_inspection.get_stock_entries_for_work_order",
        args: {
            "work_order": frm.doc.name
        },
        callback: function(r) {
            if (r.message && r.message.length > 0) {
                // Check existing Quality Inspections for these Stock Entries
                check_and_create_quality_inspections(r.message, frm);
            } else {
                frappe.msgprint(__("No Stock Entries found for this Work Order."));
            }
        }
    });
}

function check_and_create_quality_inspections(stock_entries, frm) {
    let stock_entry_names = stock_entries.map(se => se.name);
    
    frappe.call({
        method: "cn_exim.config.py.quality_inspection.check_existing_quality_inspections",
        args: {
            "stock_entries": stock_entry_names
        },
        callback: function(r) {
            if (r.message) {
                let existing_qis = r.message.existing_qis || [];
                let available_stock_entries = stock_entries.filter(se => 
                    !existing_qis.some(qi => qi.reference_name === se.name)
                );
                
                if (available_stock_entries.length === 0) {
                    // Show existing Quality Inspections as links
                    let message = __("Quality Inspections already exist for all Stock Entries:");
                    message += "<br><br>";
                    
                    existing_qis.forEach(qi => {
                        message += `<a href="/app/quality-inspection/${qi.name}" target="_blank">${qi.name}</a> (Stock Entry: ${qi.reference_name})<br>`;
                    });
                    
                    frappe.msgprint({
                        title: __("Existing Quality Inspections"),
                        message: message,
                        indicator: 'blue'
                    });
                    return;
                }
                
                // Create Quality Inspections for available Stock Entries
                create_multiple_quality_inspections(available_stock_entries, frm, existing_qis.length);
            }
        }
    });
}

function create_multiple_quality_inspections(stock_entries, frm, existing_count) {
    let created_count = 0;
    let error_count = 0;
    let total_count = stock_entries.length;
    let errors = [];
    let created_qis = [];
    
    stock_entries.forEach((stock_entry, index) => {
        frappe.call({
            method: "cn_exim.config.py.quality_inspection.create_quality_inspection_from_stock_entry",
            args: {
                "stock_entry_name": stock_entry.name,
                "work_order_name": frm.doc.name,
                "work_order_qty": frm.doc.qty
            },
            callback: function(r) {
                if (r.message && r.message.success) {
                    created_count++;
                    created_qis.push({
                        name: r.message.name,
                        stock_entry: stock_entry.name
                    });
                } else {
                    error_count++;
                    if (r.message && r.message.error) {
                        errors.push(r.message.error);
                    }
                }
                
                if ((created_count + error_count) === total_count) {
                    // All Quality Inspections processed
                    let message = "";
                    
                    if (created_count > 0) {
                        message += __("Created {0} Quality Inspections:", [created_count]);
                        message += "<br><br>";
                        
                        created_qis.forEach(qi => {
                            message += `<a href="/app/quality-inspection/${qi.name}" target="_blank">${qi.name}</a> (Stock Entry: ${qi.stock_entry})<br>`;
                        });
                        
                        if (existing_count > 0) {
                            message += "<br>" + __("{0} Quality Inspections already existed.", [existing_count]);
                        }
                    } else {
                        message = __("No new Quality Inspections created.");
                        if (existing_count > 0) {
                            message += __(" {0} Quality Inspections already existed.", [existing_count]);
                        }
                    }
                    
                    if (error_count > 0) {
                        message += "<br><br><strong>Existing Quality Inspections:</strong><br>";
                        errors.forEach(error => {
                            // Extract the Stock Entry name from error message
                            let stockEntryMatch = error.match(/Stock Entry ([A-Z-0-9]+)/);
                            if (stockEntryMatch) {
                                let stockEntryName = stockEntryMatch[1];
                                message += `• Stock Entry ${stockEntryName} already has Quality Inspection<br>`;
                            } else {
                                message += `• ${error}<br>`;
                            }
                        });
                    }
                    
                    frappe.msgprint({
                        title: __("Quality Inspections Created"),
                        message: message,
                        indicator: created_count > 0 ? 'green' : 'blue'
                    });
                }
            }
        });
    });
}

function show_stock_entries_for_quality_inspection(frm) {
    // Get Stock Entries for this Work Order
    frappe.call({
        method: "cn_exim.config.py.quality_inspection.get_stock_entries_for_work_order",
        args: {
            "work_order": frm.doc.name
        },
        callback: function(r) {
            if (r.message && r.message.length > 0) {
                show_stock_entry_selection_dialog(r.message, frm);
            } else {
                frappe.msgprint(__("No Stock Entries found for this Work Order."));
            }
        }
    });
}

function show_stock_entry_selection_dialog(stock_entries, frm) {
    let dialog = new frappe.ui.Dialog({
        title: __('Select Stock Entry for Quality Inspection'),
        fields: [
            {
                fieldtype: 'Select',
                fieldname: 'stock_entry',
                label: __('Stock Entry'),
                options: stock_entries.map(se => ({
                    label: `${se.name} (${se.posting_date}) - Qty: ${se.fg_completed_qty}`,
                    value: se.name
                })),
                reqd: 1
            }
        ],
        primary_action_label: __('Create Quality Inspection'),
        primary_action: function() {
            let selected_stock_entry = dialog.get_value('stock_entry');
            if (selected_stock_entry) {
                create_quality_inspection_from_stock_entry(selected_stock_entry, frm);
                dialog.hide();
            }
        }
    });
    
    dialog.show();
}

function create_quality_inspection_from_stock_entry(stock_entry_name, frm) {
    // Get Stock Entry details
    frappe.call({
        method: "cn_exim.config.py.quality_inspection.get_stock_entry_details",
        args: {
            "stock_entry": stock_entry_name
        },
        callback: function(r) {
            if (r.message) {
                let stock_entry = r.message;
                
                // Create Quality Inspection with Stock Entry as reference
                let qi = frappe.model.get_new_doc('Quality Inspection');
                
                // Set the reference type and name
                qi.reference_type = "Stock Entry";
                qi.reference_name = stock_entry_name;
                qi.item_code = stock_entry.finished_item;
                qi.company = stock_entry.company;
                qi.inspection_type = "In Process";
                
                // Set the custom work order quantity field
                qi.custom_work_order_qty = stock_entry.fg_completed_qty;
                
                // Set initial accepted quantity from stock entry finished quantity
                qi.custom_accepted_quantity = stock_entry.fg_completed_qty;
                
                // Set batch number and serial/batch bundle if available
                if (stock_entry.serial_and_batch_bundle) {
                    qi.custom_serial_and_batch_bundle = stock_entry.serial_and_batch_bundle;
                }
                if (stock_entry.batch_no) {
                    qi.batch_no = stock_entry.batch_no;
                }
                qi.custom_work_order = frm.doc.name;
                
                // Set report date to today
                qi.report_date = frappe.datetime.nowdate();
                
                // Set status to Under Inspection
                qi.status = "Under Inspection";
                
                // Set naming series
                qi.naming_series = "MAT-QA-.YYYY.-";
                qi.inspected_by = frappe.session.user;
                
                // Set sample size to finished good quantity
                qi.sample_size = stock_entry.fg_completed_qty;
                
                // Open the Quality Inspection form
                frappe.set_route('Form', 'Quality Inspection', qi.name);
            }
        }
    });
}
