frappe.listview_settings['Rodtep Utilization'] = {
    has_indicator_for_cancelled: true,
    has_indicator_for_Submitted: true,
    get_indicator(doc) {

        if (doc.status == "Used") {
            return [__("Used"), "green", "status,=,Used"];
        }
        else if (doc.status == "Unuse") {
            return [__("Unuse"), "red", "status,=,Unuse"];
        }
    },
}
