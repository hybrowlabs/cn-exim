frappe.ui.form.on("Pre Alert", {
    pickup_request: function (frm) {
        frappe.call({
            method: "cn_exim.cn_exim.doctype.pre_alert.pre_alert.get_exchange_rate",
            args: {
                name: frm.doc.pickup_request
            },
            callback: function (r) {
                var exchange_rate = r.message[0][0]['exchange_rate']
                var exchange = r.message[0][0]['currency']
                frm.set_value("currency", exchange)
                frm.set_value("exch_rate", exchange_rate)
                let total_inr_amount = frm.doc.total_doc_val * exchange_rate
                frm.set_value("total_inr_val", total_inr_amount)


                data = r.message[1]
                data.forEach(function (obj) {
                    var row = frm.add_child("item_details")
                    row.item_code = obj['item'];
                    row.quantity = obj['quantity']
                    row.description = obj['material_desc']
                    row.material_name = obj['material']
                    row.po_no = obj['po_number']
                    row.item_price = obj['rate']
                    row.amount = obj['amount']
                    row.item_price = obj['rate']
                    row.total_inr_value = obj['amount'] * frm.doc.exch_rate
                    frappe.call({
                        method: "frappe.client.get_list",
                        args: {
                            doctype: "Item",
                            filters: {
                                name: obj['item']
                            },
                            fields: ["name", "gst_hsn_code"]
                        },
                        callback: function (response) {
                            let hsnCode = response.message[0].gst_hsn_code;
                            row.hsn_code = hsnCode
                        }
                    })
                })
                frm.refresh_field("item_details")
            }
        })
    },
    refresh: function (frm) {
        frm.add_custom_button("Calculate", function (obj) {
            freight_amt_calculation(frm)
            insurance_calculation(frm)
            other_charges_calculation(frm)
            calculation_tax(frm)
            total_calculations(frm)
        })
        frm.add_custom_button("Pre-Check List", function () {
            let items = [];

            // Loop through item_details and push data
            frm.doc.item_details.forEach(item => {
                items.push({
                    'po_no': item.po_no,
                    'item_code': item.item_code,
                    'quantity': item.quantity,
                    'amount': item.amount,
                    'insurance_amount': item.insurance_amount,
                    'hsn_code': item.hsn_code,
                    'category': item.category,
                    'material_name': item.material_name,
                    'description': item.description,
                    'item_price': item.item_price,
                    'total_inr_value': item.total_inr_value,
                    'freight_amount': item.freight_amount,
                    'misc_charge_amt': item.misc_charge_amt,
                    'total_amount': item.total_amount,
                    'bcd_': item.bcd_,
                    'hcs_': item.hcs_,
                    'swl_': item.swl_,
                    'igst_': item.igst_,
                    'bcd_amount': item.bcd_amount,
                    'hcs_amount': item.hcs_amount,
                    'swl_amount': item.swl_amount,
                    'igst_amount': item.igst_amount
                });
            });

            // Instead of new_doc, use frappe.call to avoid redirection
            frappe.call({
                method: "frappe.client.insert",
                args: {
                    doc: {
                        'doctype': 'Pre-Alert Check List',
                        'pre_alert': frm.doc.name,
                        'pickup_request': frm.doc.pickup_request,
                        'rfq_number': frm.doc.rfq_number,
                        'vendor': frm.doc.vendor,
                        'currency': frm.doc.currency,
                        'total_doc_val': frm.doc.total_doc_val,
                        'total_inr_val': frm.doc.total_inr_val,
                        'exch_rate': frm.doc.exch_rate,
                        'freight_amt': frm.doc.freight_amt,
                        'ex_works': frm.doc.ex_works,
                        'other_charges': frm.doc.other_charges,
                        'insurance_amount': frm.doc.insurance_amount,
                        'insurance': frm.doc.insurance,
                        'accessible_val': frm.doc.accessible_val,
                        'house_number': frm.doc.house_number,
                        'master_number': frm.doc.master_number,
                        'invoice_no': frm.doc.invoice_no,
                        'invoice_dt': frm.doc.invoice_dt,
                        'eta': frm.doc.eta,
                        'etd': frm.doc.etd,
                        'invoice_details': frm.doc.invoice_details,
                        'cha': frm.doc.cha,
                        'courier': frm.doc.courier,
                        'payment_type': frm.doc.payment_type,
                        'iin_number': frm.doc.iin_number,
                        'rem_rodtep': frm.doc.rem_rodtep,
                        'tot_rodt_ut': frm.doc.tot_rodt_ut,
                        'rodtep_utilization': frm.doc.rodtep_utilization,
                        'file_attachments': frm.doc.file_attachments,
                        'igcr': frm.doc.igcr,
                        'bcd_amount': frm.doc.bcd_amount,
                        'h_cess_amount': frm.doc.h_cess_amount,
                        'sws_amount': frm.doc.sws_amount,
                        'igst_amount': frm.doc.igst_amount,
                        'total_freight': frm.doc.total_freight,
                        'total_duty': frm.doc.total_duty,
                        'remarks': frm.doc.remarks,
                        'item_details': items
                    }
                },
                callback: function (r) {
                    if (!r.exc) {
                        frappe.show_alert({
                            message: __('Pre Alert Check List created successfully!'),
                            indicator: 'green'
                        }, 5);
                    } else {
                        frappe.msgprint('There was an error saving the Pre Alert Check List');
                        console.error('Error Saving Document:', r.exc);
                    }
                }
            });
        }, __('Create'));

        frm.set_query('cha', function () {
            return {
                filters: {
                    'supplier_group': "CHA"
                }
            }
        })
    },
    total_doc_val: function (frm) {
        var total_inr = frm.doc.exch_rate * frm.doc.total_doc_val
        frm.set_value("total_inr_val", total_inr)
    },
});

frappe.ui.form.on("Pre-Alert Item Details", {
    item_code: function (frm, cdt, cdn) {
        var row = locals[cdt][cdn]
        get_percentage_of_hsn_and_category_base(frm, row)
    },
    category: function (frm, cdt, cdn) {
        var row = locals[cdt][cdn]
        get_percentage_of_hsn_and_category_base(frm, row)
    }
})

function get_percentage_of_hsn_and_category_base(frm, row) {
    if (row.hsn_code != undefined && row.category != undefined) {
        frappe.call({
            method: "cn_exim.cn_exim.doctype.pre_alert.pre_alert.get_percentage_of_hsn_and_category_base",
            args: {
                name: row.item_code,
                category: row.category
            },
            callback: function (response) {
                var data = response.message
                data.forEach(function (obj) {
                    row.bcd_ = obj['bcd']
                    row.hcs_ = obj['hcs']
                    row.swl_ = obj['swl']
                    row.igst_ = obj['igst']
                })
                frm.refresh_field("item_details")
            }
        })
    }
}


function freight_amt_calculation(frm) {
    let total_value = 0;
    let total_charge = frm.doc.freight_amt + frm.doc.ex_works

    frm.doc.item_details.forEach(item => {
        total_value += item.total_inr_value;
    });

    frm.doc.item_details.forEach(item => {
        let item_charge = (item.total_inr_value / total_value) * total_charge;
        frappe.model.set_value(item.doctype, item.name, 'freight_amount', item_charge);
        let total_inr_value = isNaN(item.total_inr_value) || item.total_inr_value == null ? 0 : item.total_inr_value;
        let freight_amount = isNaN(item.freight_amount) || item.freight_amount == null ? 0 : item.freight_amount;
        let insurance_amount = isNaN(item.insurance_amount) || item.insurance_amount == null ? 0 : item.insurance_amount;
        let misc_charge_amt = isNaN(item.misc_charge_amt) || item.misc_charge_amt == null ? 0 : item.misc_charge_amt;

        let total_amount = total_inr_value + freight_amount + insurance_amount + misc_charge_amt;

        frappe.model.set_value(item.doctype, item.name, 'total_amount', total_amount);

    });

    frm.refresh_field('item_details');
}

function insurance_calculation(frm) {
    let insurance_value = 0
    if (frm.doc.insurance_amount > 0) {
        insurance_value = frm.doc.insurance_amount;
    } else {
        insurance_value = (frm.doc.total_inr_val * frm.doc.insurance) / 100;
        frm.set_value("insurance_amount", insurance_value);
    }
    let total_value = 0;

    frm.doc.item_details.forEach(item => {
        total_value += item.total_inr_value;
    });

    frm.doc.item_details.forEach(item => {
        let item_charge = (item.total_inr_value / total_value) * insurance_value;
        frappe.model.set_value(item.doctype, item.name, 'insurance_amount', item_charge);
        let total_inr_value = isNaN(item.total_inr_value) || item.total_inr_value == null ? 0 : item.total_inr_value;
        let freight_amount = isNaN(item.freight_amount) || item.freight_amount == null ? 0 : item.freight_amount;
        let insurance_amount = isNaN(item.insurance_amount) || item.insurance_amount == null ? 0 : item.insurance_amount;
        let misc_charge_amt = isNaN(item.misc_charge_amt) || item.misc_charge_amt == null ? 0 : item.misc_charge_amt;

        let total_amount = total_inr_value + freight_amount + insurance_amount + misc_charge_amt;

        frappe.model.set_value(item.doctype, item.name, 'total_amount', total_amount);

    });
    frm.refresh_field('item_details');
}

function other_charges_calculation(frm) {
    let total_value = 0
    let other_charges = frm.doc.other_charges
    frm.doc.item_details.forEach(item => {
        total_value += item.total_inr_value;
    });
    frm.doc.item_details.forEach(item => {
        let misc_charge_amt = (item.total_inr_value / total_value) * other_charges
        if (isNaN(misc_charge_amt)) {
            misc_charge_amt = 0;
        }
        frappe.model.set_value(item.doctype, item.name, "misc_charge_amt", misc_charge_amt)
        let total_inr_value = isNaN(item.total_inr_value) || item.total_inr_value == null ? 0 : item.total_inr_value;
        let freight_amount = isNaN(item.freight_amount) || item.freight_amount == null ? 0 : item.freight_amount;
        let insurance_amount = isNaN(item.insurance_amount) || item.insurance_amount == null ? 0 : item.insurance_amount;
        let misc_charge_amt1 = isNaN(item.misc_charge_amt) || item.misc_charge_amt == null ? 0 : item.misc_charge_amt;

        let total_amount = total_inr_value + freight_amount + insurance_amount + misc_charge_amt1;

        frappe.model.set_value(item.doctype, item.name, 'total_amount', total_amount);
    })
}

function calculation_tax(frm) {
    frm.doc.item_details.forEach(item => {
        var bcd_amount = (item.bcd_ * item.total_amount) / 100
        frappe.model.set_value(item.doctype, item.name, 'bcd_amount', bcd_amount)
        var hcs_amount = (item.hcs_ * item.total_amount) / 100
        frappe.model.set_value(item.doctype, item.name, 'hcs_amount', hcs_amount)

        var swl_total = bcd_amount + hcs_amount
        var swl_amount = (item.swl_ * swl_total) / 100
        frappe.model.set_value(item.doctype, item.name, 'swl_amount', swl_amount)

        var total_igst = bcd_amount + hcs_amount + swl_amount + item.total_amount
        var igst_amount = (item.igst_ * total_igst) / 100
        frappe.model.set_value(item.doctype, item.name, 'igst_amount', igst_amount)

        var total = item.freight_amount + item.insurance_amount + item.bcd_amount + item.hcs_amount + item.swl_amount + item.igst_amount
        frappe.model.set_value(item.doctype, item.name, 'total', total)
    })
    frm.refresh_field('item_details');
}

function total_calculations(frm) {
    let accessible_val = frm.doc.total_inr_val + frm.doc.freight_amt + frm.doc.ex_works + frm.doc.insurance_amount
    frm.set_value("accessible_val", accessible_val)

    let total_bcd_amount = 0
    let total_h_cess_amount = 0
    let total_sws_amount = 0
    let total_igst_amount = 0
    let total_freight_amount = 0

    frm.doc.item_details.forEach(item => {
        total_bcd_amount += item.bcd_amount
        total_h_cess_amount += item.hcs_amount
        total_sws_amount += item.swl_amount
        total_igst_amount += item.igst_amount
        total_freight_amount += item.freight_amount
    })

    let total_duty = total_bcd_amount + total_h_cess_amount + total_igst_amount + total_sws_amount + total_freight_amount
    frm.set_value("bcd_amount", total_bcd_amount)
    frm.set_value("h_cess_amount", total_h_cess_amount)
    frm.set_value("sws_amount", total_sws_amount)
    frm.set_value("igst_amount", total_igst_amount)
    frm.set_value("total_freight", total_freight_amount)
    frm.set_value("total_duty", total_duty)

    frappe.show_alert({
        message: __('Hi, Calculation Completed'),
        indicator: 'green'
    }, 5);

}