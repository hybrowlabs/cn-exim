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
        if (frm.doc.docstatus == 1) {

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
                    'account_head': frm.doc.account_head,
                    'rate': tax_rate,
                    'tax_amount': frm.doc.igst_amount
                })


                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            'doctype': 'Bill of Entry',
                            'custom_prealert_check_list': frm.doc.name,
                            'bill_of_entry_no': frm.doc.bill_of_entry_no,
                            'bill_of_entry_date': frm.doc.bill_of_entry_date,
                            'items': items,
                            'taxes': taxes
                        }
                    },
                    callback: function (r) {
                        if (!r.exc) {
                            frappe.set_route("Form","Bill of Entry", r.message['name'])
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
        }

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

function get_percentage_of_hsn_and_category_base(frm, row_or_d, hsn_code, category) {
    if (hsn_code != undefined && category != undefined) {
        frappe.call({
            method: "cn_exim.cn_exim.doctype.pre_alert.pre_alert.get_percentage_of_hsn_and_category_base",
            args: {
                name: hsn_code,
                category: category
            },
            callback: function (response) {
                var data = response.message
                data.forEach(function (obj) {
                    row_or_d.bcd_ = obj['bcd']
                    row_or_d.hcs_ = obj['hcs']
                    row_or_d.swl_ = obj['swl']
                    row_or_d.igst_ = obj['igst']
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

        var total_duty = bcd_amount + hcs_amount + swl_amount + item.total_amount
        frappe.model.set_value(item.doctype, item.name, 'total_duty', total_duty)

        var igst_amount = (item.igst_ * total_duty) / 100
        frappe.model.set_value(item.doctype, item.name, 'igst_amount', igst_amount)

        let final_duty = item.total_duty_forgone + item.hcs_amount + item.swl_amount + item.igst_amount

        frappe.model.set_value(item.doctype, item.name, "final_total_duty", final_duty)

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
    let total_duty = 0

    frm.doc.item_details.forEach(item => {
        total_bcd_amount += item.bcd_amount
        total_h_cess_amount += item.hcs_amount
        total_sws_amount += item.swl_amount
        total_igst_amount += item.igst_amount
        total_freight_amount += item.freight_amount
        total_duty += item.final_total_duty
    })

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

function calculation_of_rodtep(frm) {
    let rodtep_total = 0;
    $.each(frm.doc.rodtep_details || [], function (i, d) {
        rodtep_total += d.amount;
    });

    frm.set_value("rem_rodtep", rodtep_total);

    let total_rodtep_utilization = 0
    $.each(frm.doc.item_details || [], function (i, d) {
        if (rodtep_total > 0) {
            d.rodtep_utilization = rodtep_total;

            let remaining = rodtep_total - d.bcd_amount;

            if (remaining < 0) {
                d.total_duty_forgone = Math.abs(remaining);
                rodtep_total = 0;
            } else {
                d.total_duty_forgone = 0;
                rodtep_total = remaining;
            }
        } else {
            d.rodtep_utilization = 0;
            d.total_duty_forgone = d.bcd_amount || 0;
        }
        if (d.bcd_amount != d.total_duty_forgone) {
            total_rodtep_utilization += d.bcd_amount
            total_rodtep_utilization -= d.total_duty_forgone
        }
    });
    frm.set_value("tot_rodt_ut", total_rodtep_utilization)
    frm.refresh_field("item_details");
}