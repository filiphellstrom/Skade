/**
 * Tar bort push-rättigheten (aps-environment) som expo-notifications
 * lägger till automatiskt.
 *
 * Skade använder bara LOKALA notiser (påminnelser om dokument, se
 * src/utils/paminnelser.ts) - de kräver ingen push-rättighet. Med
 * rättigheten kvar skulle appens provisioning-profil behöva Push
 * Notifications-förmågan, och release-bygget på EAS (som inte kan skapa
 * nya credentials själv) skulle misslyckas.
 */
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function utanPush(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults["aps-environment"];
    return c;
  });
};
