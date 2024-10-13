frappe.ui.form.on("Pre-Alert", {
    pickup_request: function (frm) {
        frappe.call({
            method: "cn_exim.cn_exim.doctype.pre_alert.pre_alert.get_exchange_rate",
            args: {
                name: frm.doc.pickup_request
            },
            callback: function (r) {
                var data = r.message[0]['exchange_rate']
                frm.set_value("exch_rate", data)
            }
        })
    },
    refresh: function (frm) {
        frm.add_custom_button("Calculate", function (obj) {
            freight_amt_calculation(frm)
            insurance_calculation(frm)
            calculation_tax(frm)
        })
    },
    total_doc_val: function (frm) {
        var total_inr = frm.doc.exch_rate * frm.doc.total_doc_val
        frm.set_value("total_inr_val", total_inr)
    },
});

frappe.ui.form.on("Pre-Alert Item Details", {
    hsn_code: function (frm, cdt, cdn) {
        var row = locals[cdt][cdn]
        get_percentage_of_hsn_and_category_base(frm, row)
    },
    category: function (frm, cdt, cdn) {
        var row = locals[cdt][cdn]
        get_percentage_of_hsn_and_category_base(frm, row)
    }
})

function get_percentage_of_hsn_and_category_base(frm, row) {
    if (row.hsn_code != undefined && row.category != '') {
        frappe.call({
            method: "cn_exim.cn_exim.doctype.pre_alert.pre_alert.get_percentage_of_hsn_and_category_base",
            args: {
                name: row.hsn_code,
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
        let total_amount = item.total_inr_value + item.freight_amount + item.insurance_amount
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
        let total_amount = item.total_inr_value + item.freight_amount + item.insurance_amount
        frappe.model.set_value(item.doctype, item.name, 'total_amount', total_amount)
    });
    frm.refresh_field('item_details');
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
    frappe.show_alert({
        message: __('Hi, Calculation Completed'),
        indicator: 'green'
    }, 5);
}