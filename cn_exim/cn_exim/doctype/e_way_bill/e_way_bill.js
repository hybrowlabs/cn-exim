// Copyright (c) 2024, Prathamesh Jadhav and contributors
// For license information, please see license.txt
frappe.ui.form.on("E-way Bill", {
    refresh: function (frm) {
        frm.set_query("transporter", function () {
            return {
                filters: {
                    is_transporter: 1
                }
            }
        })
        frm.set_query("doctype_id", function () {
            return {
                filters: {
                    docstatus: 1
                }
            }
        })
        frm.set_query('supplier_address', function (doc) {
            return {
                query: 'frappe.contacts.doctype.address.address.address_query',
                filters: {
                    link_doctype: 'Supplier',
                    link_name: doc.supplier
                }
            };
        });

        if (frm.doc.ewaybill == undefined) {
            frm.add_custom_button("e-waybill", function () {
                show_generate_custom_e_waybill_dialog(frm)
            }, __("Create"))
        }
        if (frm.doc.ewaybill != undefined) {
            frm.add_custom_button("Get E-waybill Pdf ", function () {
                attach_pdf_ewaybill(frm)
            })
        }

        if (frm.doc.docstatus == 1) {
            frm.add_custom_button("Update Po", function () {

                frappe.call({
                    method: 'cn_exim.cn_exim.doctype.e_way_bill.e_way_bill.get_all_details',
                    args: {
                        name: frm.doc.pre_alert_check_list
                    },
                    callback: function (r) {
                        let data = r.message[0]
                        let item_list = []
                        frm.doc.items.forEach(item => {
                            item_list.push({
                                purchase_order: item.purchase_order,
                                item_code: item.item_code,
                                item_name: item.item_name,
                                order_quantity: item.qty,
                                currency: data.currency,
                                total_inr_value: item.total_inr_value
                            })
                        })
                        frappe.call({
                            method: "frappe.client.insert",
                            args: {
                                doc: {
                                    doctype: "Update Po",
                                    pre_alert_check_list: frm.doc.pre_alert_check_list,
                                    pickup_request: data.pickup_request,
                                    rfq_no: data.rfq_no,
                                    vendor: data.vendor,
                                    currency: data.currency,
                                    exchange_rate: data.exchange_rate,
                                    bcd_amount: data.bcd_amount,
                                    hcs_amount: data.hcs_amount,
                                    sws_amount: data.swl_amount,
                                    igst_amount: data.igst_amount,
                                    total_duty: data.total_duty,
                                    freight_amount: data.freight_amount,
                                    ex_works: data.ex_works,
                                    other_charges: data.other_charges,
                                    insurance_amount: data.insurance_amount,
                                    insurance_: data.insurance_,
                                    house_number: data.house_number,
                                    master_number: data.master_number,
                                    total_inr_value: data.total_inr_value,
                                    accessible_value: data.accessible_value,
                                    update_po_details: item_list,
                                    e_way_bill: frm.doc.name
                                }
                            },
                            callback: function (r) {
                                frappe.set_route("Form", "Update Po", r.message['name'])
                            }
                        })
                    }
                })
            }, __("Create"))

            frm.add_custom_button("Gate Entry", function () {
                let item_list = []
                let po_no = ''
                $.each(frm.doc.items || [], function (i, d) {
                    item_list.push({
                        purchase_order: d.purchase_order,
                        item: d.item_code,
                        item_name: d.item_name,
                        uom: d.uom,
                        amount: d.total_inr_value,
                        qty: d.qty,
                    })
                    po_no = d.purchase_order
                })
                frappe.call({
                    method: "frappe.client.get_list",
                    args: {
                        doctype: "Purchase Order",
                        filters: {
                            name: po_no
                        },
                        fields: ['supplier', 'supplier_name']
                    },
                    callback: function (r) {
                        frappe.call({
                            method: "frappe.client.insert",
                            args: {
                                doc: {
                                    doctype: "Gate Entry",
                                    supplier: r.message[0]['supplier'],
                                    supplier_name: r.message[0]['supplier_name'],
                                    e_waybill_no: frm.doc.name,
                                    gate_entry_details: item_list,
                                }
                            },
                            callback: function (r) {
                                frappe.set_route("Form", "Gate Entry", r.message['name'])
                            }
                        })
                    }
                })
            }, __("Create"))
        }

        frappe.call({
            method: "cn_exim.cn_exim.doctype.e_way_bill.e_way_bill.get_gst_setting_details",
            args: {
                doctype: "GST Settings",
                field: "sandbox_mode"
            },
            callback: function (r) {
                if (r.message == 1) {
                    $(document).find(".form-sidebar .ic-sandbox-mode").remove();

                    if (!gst_settings.sandbox_mode) return;

                    $(document)
                        .find(".form-sidebar .sidebar-image-section")
                        .after(`
                            <div class="sidebar-menu ic-sandbox-mode">
                                <p><label class="indicator-pill no-indicator-dot yellow" title="${__(
                            "Your site has enabled Sandbox Mode in GST Settings."
                        )}">${__("Sandbox Mode")}</label></p>
                                <p><a class="small text-muted" href="/app/gst-settings" target="_blank">${__(
                            "Sandbox Mode is enabled for GST APIs."
                        )}</a></p>
                            </div>
                            `
                        );
                }
            }
        });
    },
    doctype_id: function (frm) {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "BOE Entry",
                filters: {
                    name: frm.doc.doctype_id
                },
                fields: ["per_alert_check", "vendor"]
            },
            callback: function (r) {
                let data = r.message[0];  // Get the first object from the list
                frm.set_value("pre_alert_check_list", data.per_alert_check);
                frm.set_value("supplier", data.vendor);

                frappe.call({
                    method: "cn_exim.cn_exim.doctype.e_way_bill.e_way_bill.get_items_details",
                    args: {
                        name: frm.doc.doctype_id,
                        pre_alert_name: frm.doc.pre_alert_check_list
                    },
                    callback: function (r) {

                        let items_data = r.message[2]
                        let total_amount = 0
                        items_data.forEach(item => {
                            let row = frm.add_child("items")
                            row.purchase_order = item.po_no
                            row.item_code = item.item_code
                            row.item_name = item.material_name
                            row.qty = item.quantity
                            row.total_inr_value = item.total_amount
                            total_amount += item.total_amount
                        })
                        frm.refresh_field("items")
                        frm.set_value("total_amount", total_amount)
                    }
                })
            }
        })
    },
    supplier_address: function (frm) {
        erpnext.utils.get_address_display(frm, "supplier_address", "address", false);
    },
    bill_from: function (frm) {
        erpnext.utils.get_address_display(frm, "bill_from", "bill_from_address", false)
    },
    bill_to: function (frm) {
        erpnext.utils.get_address_display(frm, "bill_to", "bill_to_address", false)
    },
    ship_from: function (frm) {
        erpnext.utils.get_address_display(frm, "ship_from", "ship_from_address", false)
    },
    ship_to: function (frm) {
        erpnext.utils.get_address_display(frm, "ship_to", "ship_to_address", false)
    },
    onload: function (frm) {
        if (frm.doc.address == undefined) {
            erpnext.utils.get_address_display(frm, "supplier_address", "address", false);
        }
        frm.set_query("select_doctype", function () {
            return {
                filters: {
                    'istable': 0
                }
            }
        })

        frm.set_query('bill_from', function () {
            return {
                query: "frappe.contacts.doctype.address.address.address_query",
                filters: {
                    link_doctype: 'Company',
                    link_name: frm.doc.company
                }
            };
        });

        frm.set_query("bill_to", function () {
            return {
                query: "frappe.contacts.doctype.address.address.address_query",
                filters: {
                    link_doctype: "Supplier"
                }
            }
        })

        frm.set_query("ship_to", function () {
            return {
                query: "frappe.contacts.doctype.address.address.address_query",
                filters: {
                    link_doctype: "Supplier"
                }
            }
        })
    }
});



// Generate Custom e-Waybill
function show_generate_custom_e_waybill_dialog(frm) {
    // Function to call the Python method
    const generate_action = values => {
        frappe.call({
            method: "india_compliance.gst_india.utils.e_waybill.generate_e_waybill",
            args: {
                doctype: frm.doctype,
                docname: frm.doc.name,
                values: values
            },
            callback: function (response) {
                data = response.message
                frappe.set_value("ewaybill", data.ewaybill)
            }
        });
    };

    const dialog = new frappe.ui.Dialog({
        title: __("Generate Custom e-Waybill"),
        fields: [
            {
                label: "Document Details",
                fieldname: "section_doc_details",
                fieldtype: "Section Break",
            },
            {
                label: "Supply Type",
                fieldname: "supply_type",
                fieldtype: "Select",
                options: "Inward\nOutward",
                reqd: 1,
            },
            {
                label: "Sub Supply Type",
                fieldname: "sub_supply_type",
                fieldtype: "Select",
                options: "Import\nExport\nJob Work\nOthers",
                reqd: 1,
            },
            {
                label: "Sub Supply Description",
                fieldname: "sub_supply_desc",
                fieldtype: "Data",
                depends_on: "eval: doc.sub_supply_type == 'Others'",
            },
            {
                label: "Part A",
                fieldname: "section_part_a",
                fieldtype: "Section Break",
            },
            {
                label: "Transporter",
                fieldname: "transporter",
                fieldtype: "Link",
                options: "Supplier",
                get_query: () => {
                    return {
                        filters: {
                            is_transporter: 1,
                        },
                    };
                },
            },
            {
                label: "Distance (in km)",
                fieldname: "distance",
                fieldtype: "Float",
                description: "Enter the distance for transportation",
                default: 0,
            },
            {
                label: "GST Transporter ID",
                fieldname: "gst_transporter_id",
                fieldtype: "Data",
            },
            {
                label: "Part B",
                fieldname: "section_part_b",
                fieldtype: "Section Break",
            },
            {
                label: "Vehicle No",
                fieldname: "vehicle_no",
                fieldtype: "Data",
            },
            {
                label: "Mode Of Transport",
                fieldname: "mode_of_transport",
                fieldtype: "Select",
                options: "Road\nAir\nRail\nShip",
                default: "Road",
            },
            {
                label: "GST Vehicle Type",
                fieldname: "gst_vehicle_type",
                fieldtype: "Select",
                options: "Regular\nOver Dimensional Cargo (ODC)",
                depends_on: "eval: doc.mode_of_transport == 'Road'",
                default: "Regular",
            },
        ],
        primary_action_label: __("Generate"),
        primary_action(values) {
            dialog.hide();
            generate_action(values);
        },
    });

    // Fetch data and auto-fill fields
    function auto_fill_dialog() {
        // Example: Fetch data using frappe.call or use frm.doc directly
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "E-way Bill",
                name: frm.doc.name, // Replace with actual docname
            },
            callback: function (response) {
                if (response && response.message) {
                    const doc = response.message;

                    // Set values in the dialog
                    dialog.set_value("transporter", doc.transporter || "");
                    dialog.set_value("distance", doc.distance || 0);
                    dialog.set_value("gst_transporter_id", doc.gst_transporter_id || "");
                    dialog.set_value("vehicle_no", doc.vehicle_no || "");
                    dialog.set_value("mode_of_transport", doc.mode_of_transport || "Road");
                    dialog.set_value("gst_vehicle_type", doc.gst_vehicle_type || "Regular");
                    dialog.set_value("supply_type", doc.supply_type || "")
                    dialog.set_value("sub_supply_type", doc.sub_supply_type || "")
                }
            },
        });
    }

    // Show the dialog and auto-fill fields
    dialog.show();
    auto_fill_dialog();

}


function attach_pdf_ewaybill(frm) {
    frappe.call({
        method: "india_compliance.gst_india.utils.e_waybill.fetch_e_waybill_data",
        args: {
            doctype: frm.doctype,
            docname: frm.doc.name,
            attach: true
        },
        callback: function (r) {
            frm.refresh();
        }
    })
}