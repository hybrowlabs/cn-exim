// Copyright (c) 2024, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.ui.form.on("Pickup Request", {
    refresh(frm) {
        if (frm.doc.docstatus == 1) {
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Request for Quotation',
                    filters: {
                        'custom_pickup_request': frm.doc.name
                    },
                    fields: ['name']
                },
                callback: function (r) {
                    if (r.message && r.message.length > 0) {
                        frappe.call({
                            method: "frappe.client.get_list",
                            args: {
                                doctype: "Supplier Quotation",
                                filters: {
                                    custom_pickup_request: frm.doc.name,
                                    docstatus:1
                                },
                                fields: ['supplier']
                            },
                            callback: function (response) {
                                frm.add_custom_button("Pre Alert", function () {
                                    console.log(r.message[0]['name'])
                                    frappe.new_doc("Pre Alert", {
                                        'pickup_request': frm.doc.name,
                                        'rfq_number': r.message[0]['name'],
                                        'vendor': response.message[0]['supplier']
                                    }).then(doc => {
                                        frappe.set_route('Form', 'Pre Alert', doc.name);
                                    });
                                }, ("Create"));
                            }
                        })
                    }
                }
            });

            frm.add_custom_button("Request for Quotation", function () {
                frappe.new_doc('Request for Quotation', {
                    'custom_type': "Logistics",
                    'custom_pickup_request': frm.doc.name,
                    'custom_port_of_loading': frm.doc.pol,
                    'custom_mode_of_shipment': frm.doc.mode_of_shipment,
                    'custom_pickup_supplier': frm.doc.name_of_supplier,
                    'custom_shipment_type': frm.doc.type_of_shipments,
                    'custom_no_of_pkg_units': frm.doc.no_of_boxes,
                    'custom_port_of_destination': frm.doc.pod,
                    'custom_vol_weight': frm.doc.gross_weight,
                    'custom_actual_weights': frm.doc.chargeable_weight,
                    'incoterm': frm.doc.incoterms,
                }).then(doc => {
                    frappe.set_route('Form', 'Request for Quotation', doc.name);
                });
            }, ("Create"))
        }

        frm.set_query('supplier_address', function (doc) {
            return {
                query: 'frappe.contacts.doctype.address.address.address_query',
                filters: {
                    link_doctype: 'Supplier',
                    link_name: doc.name_of_supplier
                }
            };
        });
        frm.set_query('billing_address', function (doc) {
            return {
                query: 'frappe.contacts.doctype.address.address.address_query',
                filters: {
                    link_doctype: 'Company',
                    link_name: doc.company
                }
            };
        })
        frm.set_query('pickup_address', function (doc) {
            return {
                query: 'frappe.contacts.doctype.address.address.address_query',
                filters: {
                    link_doctype: 'Supplier',
                    link_name: doc.name_of_supplier
                }
            };
        });
        frm.set_query('name_of_supplier', function () {
            return {
                filters: {
                    'supplier_group': ['!=', "CHA"]
                }
            }
        })

        frm.add_custom_button("Purchase Order", function () {
            let d = new frappe.ui.form.MultiSelectDialog({
                doctype: "Purchase Order",
                target: this.cur_frm,
                setters: {
                    transaction_date: null,
                    supplier: frm.doc.name_of_supplier,
                    custom_purchase_type: "Import"
                },
                add_filters_group: 1,
                date_field: 'transaction_date',
                columns: ['name', 'transaction_date', 'supplier', 'Purchase Type'],
                get_query() {
                    return {
                        filters: {
                            docstatus: ['!=', 2]
                        }
                    }
                },
                action: async function (selections) {
                    d.dialog.hide()
                    selections.forEach(item => {
                        frappe.call({
                            method: "cn_exim.cn_exim.doctype.pickup_request.pickup_request.get_po_all_details",
                            args: {
                                po_name: item
                            },
                            callback: function (r) {
                                let row = frm.add_child("purchase_order_list")
                                row.po_number = r.message['name']
                                row.document_date = r.message['transaction_date']
                                row.po_type = r.message['custom_purchase_type']
                                row.vendor = r.message['supplier']
                                row.vendor_name = r.message['supplier_name']
                                row.currency = r.message['currency']
                                row.company = r.message['company']
                                row.exchange_rate = r.message['conversion_rate']

                                let po_items = r.message['items']

                                po_items.forEach(item => {
                                    let item_row = frm.add_child("purchase_order_details")
                                    item_row.item = item.item_code
                                    item_row.material = item.item_name
                                    item_row.quantity = item.qty
                                    item_row.material_desc = item.description
                                    item_row.pick_qty = item.qty
                                    item_row.po_number = item.parent
                                    item_row.currency = r.message['currency']
                                    item_row.currency_rate = r.message['conversion_rate']
                                    item_row.rate = item.rate
                                    item_row.amount = item.amount
                                    item_row.amount_in_inr = item.base_amount
                                })
                                frm.refresh_field("purchase_order_list")
                                frm.refresh_field("purchase_order_details")
                            }
                        })
                    })
                }
            })
            d.dialog.show()
        }, __("Get Detail"))
    },
    supplier_address: function (frm) {
        erpnext.utils.get_address_display(frm, "supplier_address", "supplier_address_display", false);
    },
    billing_address: function (frm) {
        erpnext.utils.get_address_display(frm, "billing_address", "billing_address_display", false);
    },
    supplier_pickup_address: function (frm) {
        erpnext.utils.get_address_display(frm, "supplier_pickup_address", "pickup_address", false);
    },
    custom_get_po_items: function (frm) {
        frappe.call({
            "method": "get_items",
            doc: frm.doc,
            args: {
                po: frm.doc.purchase_order_list,
            },
            callback: function (r) {
                frm.refresh()
            }
        })
    },
    before_save: function (frm) {
        calculation_of_amount_and_inr_amount(frm)
    },
    validate: function (frm) {
        let validation_failed = false; // To track validation status
        let promises = []; // Collect promises for all frappe.call calls

        // Iterate over the child table
        $.each(frm.doc.purchase_order_details || [], function (i, d) {
            // Push frappe.call as a promise into the promises array
            promises.push(
                frappe.call({
                    method: "cn_exim.cn_exim.doctype.pickup_request.pickup_request.validate_po_order_qty_to_pickup_qty",
                    args: {
                        po_no: d.po_number,
                        item_code: d.item
                    }
                }).then(r => {
                    if (r.message) {
                        let qty = r.message[0]['qty'];
                        let received_qty = r.message[0]['received_qty'];
                        let check_qty = qty - received_qty;

                        if (d.pick_qty > check_qty) {
                            validation_failed = true;
                            frappe.msgprint({
                                title: __("Invalid Pickup Quantity"),
                                indicator: "red",
                                message: __(
                                    `You cannot pick up more than the available PO quantity for item ${d.item}. Please check the PO quantity.`
                                )
                            });
                        }
                    }
                })
            );
        });

        // Wait for all validations to complete
        return Promise.all(promises).then(() => {
            if (validation_failed) {
                frappe.validated = false; // Prevent form submission
            }
        });
    },
    mode_of_shipment: function (frm) {
        if (frm.doc.mode_of_shipment == "Ocean liner") {
            frm.set_value("type_wise_value", 6000)
        }
        else if (frm.doc.mode_of_shipment == "MOS1-AIR") {
            frm.set_value("type_wise_value", 5000)
        }
    },
    type_wise_value: function (frm) {
        var total_weight = 0
        $.each(frm.doc.dimension_calculation || [], function (i, d) {
            var weight = ((d.width ? d.width : 1) * (d.length ? d.length : 1) * (d.height ? d.height : 1)) / (frm.doc.type_wise_value ? frm.doc.type_wise_value : 1);
            d.weight = weight
            total_weight += d.weight
        })
        frm.refresh_field("dimension_calculation")
        frm.set_value("chargeable_weight", total_weight)
    },
    get_pos: function (frm) {
        let purchase_order = []
        $.each(frm.doc.purchase_order_details || [], function (i, d) {
            const isAlreadyInList = purchase_order.some(item => item === d.po_number)
            if (!isAlreadyInList) {
                purchase_order.push(d.po_number)
            }
        })

        purchase_order.forEach(function (obj) {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Purchase Order",
                    filters: {
                        name: obj
                    },
                    fields: ["supplier", "currency", "conversion_rate", "transaction_date", "custom_purchase_type", "company"]
                },
                callback: function (r) {
                    let data = r.message
                    var row = frm.add_child("purchase_order_list")
                    row.po_number = obj
                    row.document_date = data[0]['transaction_date']
                    row.vendor = data[0]['supplier']
                    row.vendor_name = data[0]['supplier']
                    row.po_type = data[0]['custom_purchase_type']
                    row.currency = data[0]['currency']
                    row.company = data[0]['company']
                    row.exchange_rate = data[0]['conversion_rate']
                    frm.refresh_field("purchase_order_list")
                }
            })
        })

        $.each(frm.doc.purchase_order_details || [], function (i, d) {
            frappe.call({
                method: "cn_exim.cn_exim.doctype.pickup_request.pickup_request.get_items_details",
                args: {
                    parent: d.po_number,
                    item_name: d.item
                },
                callback: function (r) {
                    let data = r.message
                    console.log(data[0])
                    const parent_date = data[0]
                    const child_date = data[1]

                    d.currency = parent_date[0]['currency']
                    d.currency_rate = parent_date[0]['conversion_rate']
                    d.rate = child_date[0]['rate']
                    d.amount = d.pick_qty * child_date[0]['rate']
                    d.amount_in_inr = d.amount * parent_date[0]['conversion_rate']
                    frm.refresh_field("purchase_order_details")
                }
            })
        })
    }
})

frappe.ui.form.on("Dimension Calculation", {
    length: function (frm, cdt, cdn) {
        var row = locals[cdt][cdn]
        dimension_calculation(frm, row)
    },
    width: function (frm, cdt, cdn) {
        var row = locals[cdt][cdn]
        dimension_calculation(frm, row)
    },
    height: function (frm, cdt, cdn) {
        var row = locals[cdt][cdn]
        dimension_calculation(frm, row)
    },
    box: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn]
        row.gross_weight = row.box * row.weight
        frm.refresh_field("dimension_calculation")
        let total_gross_weight = 0
        $.each(frm.doc.dimension_calculation || [], function (i, d) {
            total_gross_weight += d.gross_weight
        })
        frm.set_value("gross_weight", total_gross_weight)
    }
})


frappe.ui.form.on("Purchase Order Details", {
    pick_qty: function (frm) {
        calculation_of_amount_and_inr_amount(frm)
    },
    rate: function (frm) {
        calculation_of_amount_and_inr_amount(frm)
    }
})

function dimension_calculation(frm, row) {
    var weight = ((row.width ? row.width : 1) * (row.length ? row.length : 1) * (row.height ? row.height : 1)) / (frm.doc.type_wise_value ? frm.doc.type_wise_value : 1);
    row.weight = weight
    frm.refresh_field("dimension_calculation")
    var total_weight = 0
    frm.doc.dimension_calculation.forEach(item => {
        total_weight += item.weight
    })
    frm.set_value("chargeable_weight", total_weight)
}

function calculation_of_amount_and_inr_amount(frm) {
    var total_amount = 0
    frm.doc.purchase_order_details.forEach(item => {
        frappe.call({
            method: "erpnext.setup.utils.get_exchange_rate",
            args: {
                from_currency: item.currency,
                to_currency: "INR",
                transaction_date: frappe.datetime.get_today()
            },
            callback: function (r) {
                frappe.model.set_value(item.doctype, item.name, "currency_rate", r.message)
            }
        })
        var amount = item.pick_qty * item.rate
        var amount_inr = item.currency_rate * amount
        frappe.model.set_value(item.doctype, item.name, 'amount', amount)
        frappe.model.set_value(item.doctype, item.name, 'amount_in_inr', amount_inr)
        total_amount += item.amount
    })
    frm.set_value("total_amount", total_amount)
}
