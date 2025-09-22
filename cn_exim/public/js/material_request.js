frappe.ui.form.on("Material Request", {
    validate: function (frm) {
        if (frm.doc.material_request_type == "Purchase") {
            let promises = [];

            frm.doc.items.forEach(item => {
                let p = frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Item",
                        filters: {
                            name: item.item_code
                        },
                        fieldname: ["min_order_qty"]
                    }
                }).then(r => {
                    if (r.message && item.qty < r.message.min_order_qty) {
                        frappe.msgprint(`Item ${item.item_code} has qty less than minimum order quantity (${r.message.min_order_qty}).`);
                        frappe.validated = false;
                    }
                });

                promises.push(p);
            });

            return Promise.all(promises);
        }
    },
    refresh: function (frm) {
        const isApproved = frm.doc.workflow_state == "Approved";

        frappe.call({
            method: 'frappe.client.get_single_value',
            args: {
                doctype: 'Custom Settings',
                field: 'disable_rfq_button_on_mr'
            },
            callback: function(r) {
                const disabled = r.message || false;
                console.log("disable_rfq_button_on_mr", disabled);

                if (!isApproved) {
                    frm.remove_custom_button("Pick List", "Create");
                    frm.remove_custom_button("Material Transfer", "Create");
                    frm.remove_custom_button("Material Transfer (In Transit)", "Create");
                    frm.remove_custom_button("Request for Quotation", "Create");
                }

                if (frm.doc.docstatus == 1 && frm.doc.material_request_type == "Purchase" && isApproved && !disabled) {
                    frm.remove_custom_button("Request for Quotation", "Create");
                    frm.add_custom_button(__("Request for Quotations"), function () {
                        frappe.call({
                            method: "cn_exim.config.py.material_request.create_rfqs",
                            args: {
                                doc: frm.doc
                            },
                            callback: function (r) {
                                if (r.message && r.message.rfqs && r.message.rfqs.length > 0) {
                                    let rfq_list = r.message.rfqs.join(", ");
                                    frappe.msgprint({
                                        title: __('RFQs Created Successfully'),
                                        message: rfq_list,
                                        indicator: 'green'
                                    });
                                } else {
                                    frappe.msgprint({
                                        title: __('No RFQs Created'),
                                        message: __('No RFQs were created.'),
                                        indicator: 'orange'
                                    });
                                }
                            }
                        })
                    }, __("Create"));
                }
            }
        });

        if (frm.doc.docstatus == 1 && frm.doc.status == "Pending") {
            frm.add_custom_button("Update Item", function () {
                let dialog = new frappe.ui.Dialog({
                    title: "Update Items",
                    size: "Large",
                    fields: [
                        {
                            label: "Update Item",
                            fieldname: "update_item",
                            fieldtype: "Table",
                            cannot_add_rows: true, // ✅ Prevent adding new rows
                            in_place_edit: true,
                            fields: [
                                {
                                    label: "Item Code",
                                    fieldname: "item_code",
                                    fieldtype: "Link",
                                    options: "Item",
                                    in_list_view: 1,
                                    read_only: 1 // ✅ Prevent editing
                                },
                                {
                                    label: "Qty",
                                    fieldname: "qty",
                                    fieldtype: "Float",
                                    in_list_view: 1
                                },
                                {
                                    label: "Row Id",
                                    fieldname: "row_id",
                                    fieldtype: "Data",
                                    read_only: 1 // ✅ Prevent editing
                                }
                            ]
                        }
                    ],
                    primary_action_label: "Update",
                    primary_action(value) {
                        let data = value.update_item;
                        let has_error = false;

                        data.forEach(item => {
                            if (!item.row_id) {
                                frappe.msgprint("Do not add new items.");
                                has_error = true;
                                return;
                            }

                            const original_row = frm.doc.items.find(row => row.name === item.row_id);
                            if (!original_row || item.qty < original_row.qty) {
                                frappe.msgprint(`Invalid Qty for ${item.item_code}.`);
                                has_error = true;
                                return;
                            }
                        });

                        if (has_error) return;

                        dialog.hide();

                        frappe.call({
                            method: "cn_exim.config.py.material_request.bulk_update_material_request_items",
                            args: {
                                items: JSON.stringify(data)
                            },
                            callback: function () {
                                frm.reload_doc();
                            }
                        });
                    }
                });

                // Show dialog
                dialog.show();

                // Load existing items from the form
                const existing_items = frm.doc.items.map(row => ({
                    item_code: row.item_code,
                    qty: row.qty,
                    row_id: row.name
                }));

                // Set data into dialog table
                dialog.fields_dict.update_item.df.data = existing_items;

                // Refresh the grid UI
                dialog.fields_dict.update_item.grid.refresh();
            });
        }
    },
    onload: function (frm) {
        if (!frm.doc.custom_requisitioner) {
            let user = frappe.session.user
            frappe.call({
                method: "frappe.client.get_value",
                args: {
                    doctype: "Employee",
                    filters: {
                        user_id: user
                    },
                    fieldname: ["name", "cell_number", "company_email"]
                },
                callback: function (r) {
                    data = r.message
                    frm.set_value("custom_requisitioner", data.name)
                    frm.set_value("custom_requisitioner_email", data.company_email)
                    frm.set_value("custom_requisitioner_phone", data.cell_number)
                }
            })
        }
    }
})

frappe.ui.form.on("Material Request Item", {
    item_code: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn]
        row.custom_plant = frm.doc.custom_plant
    }
})