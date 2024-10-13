// Copyright (c) 2024, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.ui.form.on("Pre-Alert Check List", {
    refresh(frm) {
        frm.add_custom_button("Calculate", function (obj) {
            freight_amt_calculation(frm)
            insurance_calculation(frm)
            other_charges_calculation(frm)
            calculation_tax(frm)
            total_calculations(frm)
        })
        frm.add_custom_button("Bill of Entry", function () {
            let items = []
            let taxes = []
            let tax_rate = 0
            frm.doc.item_details.forEach(item => {
                let customs_duty = parseFloat(item.bcd_amount || 0) + parseFloat(item.hcs_amount || 0) + parseFloat(item.swl_amount || 0);
                items.push({
                    'item_code': item.item_code,
                    'item_name': item.material_name,
                    'assessable_value': parseFloat(item.total_amount || 0),
                    'gst_hsn_code': item.hsn_code,
                    'customs_duty': customs_duty,
                })
                tax_rate = item.igst_
            })
            taxes.push({
                'charge_type': frm.doc.charge_type,
                'account_head':frm.doc.account_head,
                'rate': tax_rate,
                'tax_amount':frm.doc.igst_amount
            })


            frappe.call({
                method: "frappe.client.insert",
                args: {
                    doc: {
                        'doctype': 'Bill of Entry',
                        'custom_prealert_check_list': frm.doc.name,
                        'bill_of_entry_no': frm.doc.bill_of_entry_no,
                        'bill_of_entry_date': frm.doc.bill_of_entry_date,
                        'items':items,
                        'taxes':taxes
                    }
                },
                callback: function (r) {
                    if (!r.exc) {
                        frappe.show_alert({
                            message: __('Bill of Entry created successfully!'),
                            indicator: 'green'
                        }, 5);
                    } else {
                        frappe.msgprint('There was an error saving the Bill of Entry');
                        console.error('Error Saving Document:', r.exc);
                    }
                }
            })
        }, __("Create"))
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