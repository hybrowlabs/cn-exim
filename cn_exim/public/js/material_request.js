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
    onload: function (frm) {
        frm.set_query('custom_line_of_business', function () {
            return {
                filters: {
                    'is_group': 0  // Filter to show only child Cost Centers
                }
            };
        });

        frm.set_query("custom_group_warehouse", function () {
            return {
                "filters": {
                    "is_group": 1,
                }
            };
        });

        frm.set_query("set_warehouse", function () {
            return {
                "filters": {
                    'parent_warehouse': frm.doc.custom_group_warehouse,
                    "is_group": 0,
                }
            };
        });

        frm.set_query("custom_group_warehouse", function () {
            return {
                "filters": {
                    "is_group": 1,
                }
            };
        });

        // Set query for custom_cc field in the child table
        frm.fields_dict["items"].grid.get_field("custom_parent_cost_center").get_query = function () {
            return {
                filters: {
                    is_group: 1
                }
            };
        };

        // Set query for custom_cost_centre field in the child table
        frm.fields_dict["items"].grid.get_field("segment").get_query = function (doc, cdt, cdn) {
            var child = locals[cdt][cdn];
            return {
                filters: {
                    parent_segment: child.custom_parent_cost_center,
                    is_group: 0,
                    disable: 0
                }
            };
        };

        // Set query for custom_cc field
        frm.set_query("custom_cc", function () {
            return {
                "filters": {
                    "is_group": 1
                }
            };
        });

        // Set query for segment field
        frm.set_query("custom_cost_centre", function () {
            return {
                "filters": {
                    'parent_segment': frm.doc.custom_cc,
                    "is_group": 0,
                    "disable": 0,
                    "plant": frm.doc.custom_plant
                }
            };
        });
    },
    custom_line_of_business: function (frm) {
        let Segment = frm.doc.custom_line_of_business;

        frm.doc.items.forEach(function (item) {
            item.cost_center = Segment;
        });
    },
    custom_group_warehouse: function (frm) {
        let group_warehouse = frm.doc.custom_group_warehouse;

        frm.doc.items.forEach(function (item) {
            item.custom_group_warehouse = group_warehouse;
        });
        frm.refresh_field('items');
    },
    custom_cost_centre: function (frm) {
        let customCostCentre = frm.doc.custom_cost_centre;

        frm.doc.items.forEach(function (item) {
            item.segment = customCostCentre;
        });
    },
    custom_cc: function (frm) {
        let customCC = frm.doc.custom_cc;

        frm.doc.items.forEach(function (item) {
            item.custom_parent_cost_center = customCC;
        });
        // Check if custom_cc and custom_plant are both filled
        if (frm.doc.custom_cc && frm.doc.custom_plant) {
            // Fetch segments where custom_cc and custom_plant match
            frappe.db.get_list('Segment', {
                filters: {
                    'parent_segment': frm.doc.custom_cc,
                    'plant': frm.doc.custom_plant,
                    "is_group": 0,
                    "disable": 0
                },
                fields: ['name']
            }).then(records => {
                if (records.length > 0) {
                    if (records.length === 1)

                        // If exactly one matching segment is found, set the custom_cost_centre field
                        frm.set_value('custom_cost_centre', records[0].name);
                } else {
                    // If no matching segment or more than one segment is found, clear the custom_cost_centre field
                    frm.set_value('custom_cost_centre', '');
                }
            });
        } else {
            // Clear custom_cost_centre if custom_cc or custom_plant is empty
            frm.set_value('custom_cost_centre', '');
        }
    },
    refresh: function (frm) {
        // Ensure the items table is updated when the form is refreshed
        if (frm.doc.custom_cost_centre) {
            frm.doc.items.forEach(function (item) {
                item.segment = frm.doc.custom_cost_centre;
            });
        }

        if (frm.doc.custom_cc) {
            frm.doc.items.forEach(function (item) {
                item.custom_parent_cost_center = frm.doc.custom_cc;
            });
        }

        frm.refresh_field('items');
    },
})

frappe.ui.form.on("Material Request Item", {
    item_code: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn]
        row.custom_plant = frm.doc.custom_plant
    },
    custom_parent_cost_center: function (frm, cdt, cdn) {
        var child = locals[cdt][cdn];
        frm.fields_dict["items"].grid.get_field("segment").get_query = function () {
            return {
                filters: {
                    parent_segment: child.custom_parent_cost_center,
                    is_group: 0,
                    disable: 0
                }
            };
        };
    }
})