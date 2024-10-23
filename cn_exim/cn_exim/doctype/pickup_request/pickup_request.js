// Copyright (c) 2024, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.ui.form.on("Pickup Request", {
    refresh(frm) {
        if (frm.doc.docstatus == 1) {
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
                    'custom_remarks': frm.doc.remarks,
                    'incoterm': frm.doc.incoterms,
                }).then(doc => {
                    frappe.set_route('Form', 'Request for Quotation', doc.name);
                });
            }, ("Create"))

            frm.add_custom_button("Pre Alert", function () {
                frappe.new_doc("Pre Alert", {
                    'pickup_request':frm.doc.name
                }).then(doc => {
                    frappe.set_route('Form', 'Pre Alert', doc.name)
                })
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
    },
    mode_of_shipment: function (frm) {
        if (frm.doc.mode_of_shipment == "Ocean liner") {
            frm.set_value("type_wise_value", 6000)
        }
        else if (frm.doc.mode_of_shipment == "MOS1-AIR") {
            frm.set_value("type_wise_value", 5000)
        }
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
    }
})

function dimension_calculation(frm, row) {
    var weight = ((row.width ? row.width : 1) * (row.length ? row.length : 1) * (row.height ? row.height : 1)) / (frm.doc.type_wise_value ? frm.doc.type_wise_value : 1);
    row.weight = weight
    frm.refresh_field("dimension_calculation")
    var total_weight = 0
    frm.doc.dimension_calculation.forEach(item => {
        total_weight += row.weight
    })
    frm.set_value("chargeable_weight", total_weight)
}