"use strict";

/*
 * Created with @iobroker/create-adapter v1.26.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
// Load your modules here, e.g.:
// const fs = require("fs");
const axios = require("axios").default;
class GoE extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "go-e",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));

        // Timer Object for the update interval for ampere to the adapter
        this.ampTimer = null;
    }
    
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info("Server: " + this.config.serverName);
        this.log.info("Intervall: " + this.config.serverInterval);

        
        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        this.subscribeStates("ampere");
        this.subscribeStates("color.*");
        this.subscribeStates("led_save_energy");
        this.subscribeStates("access_state");
        this.subscribeStates("allow_charging");
        this.subscribeStates("max_load");
        this.subscribeStates("stop_state");
        this.subscribeStates("electricity_exchange.max_watts");

        // Start the Adapter to sync in the interval
        this.interval = setInterval(async () => {
            await this.getStateFromDevice();
        }, this.config.serverInterval * 1000);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);
            // @ts-ignore
            clearInterval(this.interval);
            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack}) namespace: ` + this.namespace);
            if (!state.ack) {
                // If it is already acknoladged, we dont have to send it to the go-eCharger device.
                // Handle null values with the rejection 
                if(state.val === null) {
                    this.log.warn("Not able to handle null Values in " + id);
                    return;
                }
                switch (id) {
                    case this.namespace + ".ampere":
                        this.setValue("amp", state.val.toString());
                        break;
                    case this.namespace + ".color.idle":
                        // @ts-ignore // Check off null is done
                        this.setValue("cid", /^#?([a-f\d]{6})$/i.exec(state.val.toString()) !== null ? parseInt(/^#?([a-f\d]{6})$/i.exec(state.val.toString())[1], 16) : 0);
                        break;
                    case this.namespace + ".color.charging":
                        // @ts-ignore // Check off null is done
                        this.setValue("cid", /^#?([a-f\d]{6})$/i.exec(state.val.toString()) !== null ? parseInt(/^#?([a-f\d]{6})$/i.exec(state.val.toString())[1], 16) : 0);
                        break;
                    case this.namespace + ".color.finish":
                        // @ts-ignore // Check off null is done
                        this.setValue("cid", /^#?([a-f\d]{6})$/i.exec(state.val.toString()) !== null ? parseInt(/^#?([a-f\d]{6})$/i.exec(state.val.toString())[1], 16) : 0);
                        break;
                    case this.namespace + ".led_save_energy":
                        this.setValue("lse", parseInt(state.val.toString()));
                        break;
                    case this.namespace + ".access_state":
                        if(parseInt(state.val.toString()) == 0 || parseInt(state.val.toString()) == 1 ) {
                            this.setValue("ast", parseInt(state.val.toString()));
                        } else {
                            this.log.warn("Could not set value " + state.val.toString() + " in " + id);
                        }
                        break;
                    case this.namespace + ".allow_charging":
                        if(parseInt(state.val.toString()) == 0 || parseInt(state.val.toString()) == 1 ) {
                            this.setValue("alw", parseInt(state.val.toString()));
                        } else {
                            this.log.warn("Could not set value " + state.val.toString() + " in " + id);
                        }
                        break;
                    case this.namespace + ".stop_state":
                        if(parseInt(state.val.toString()) == 0 || parseInt(state.val.toString()) == 2 ) {
                            this.setValue("stp", parseInt(state.val.toString()));
                        } else {
                            this.log.warn("Could not set value " + state.val.toString() + " in " + id);
                        }
                        break;
                    case this.namespace + ".max_load":
                        this.setValue("dwo", parseInt(state.val.toString()) * 10);
                        break;
                    case this.namespace + ".electricity_exchange.max_watts":
                        
                        break;
                    default:
                        this.log.error("Not deveoped function to write " + id + " with state " + state);
                }
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    //     if (typeof obj === "object" && obj.message) {
    //         if (obj.command === "send") {
    //             // e.g. send email or pushover or whatever
    //             this.log.info("send command");

    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    //         }
    //     }
    // }

    // go-eCharger functions
    async getStateFromDevice() {
        this.log.debug("Starte Abfrage an: http://" + this.config.serverName + "/status");
        await axios.get("http://" + this.config.serverName + "/status")
            .then((o) => {
                this.log.debug("Response: " + o.status + " - " + o.statusText);
                this.log.info(JSON.stringify(o.data));

                this.processStatusObject(o.data);
                
            })
            .catch(e => {
                this.log.error(e.message);
            });
    }
    /**
     * Process a default status response as descibed in the api documentation of go-eCharger
     * @param {object} o 
     */
    async processStatusObject(o) {
        // Const for variable pha
        const postContactorPhase1 = 1;
        const postContactorPhase2 = 2;
        const postContactorPhase3 = 4;
        const preContactorPhase1 = 8;
        const preContactorPhase2 = 16;
        const preContactorPhase3 = 32;

        // It acuses a high workload when ioBoroker have to write more than 10 variables in parallel. It splittet into several blocks here
        // Write vaiable in 10 Elememt groups
        await (o => {
            this.setState("encryption",                         { val: o.version == "C" ? true : false, ack: true }); // read
            this.setState("synctime",                           { val: o.tme, ack: true }); 
            this.setState("reboot_counter",                     { val: o.rbc, ack: true }); // read
            this.setState("reboot_timer",                       { val: o.rbt, ack: true }); // read
            this.setState("car",                                { val: o.car, ack: true }); // read
            this.setState("ampere",                             { val: o.amp, ack: true }); // write
            this.setState("error",                              { val: o.err, ack: true }); // read
            this.setState("access_state",                       { val: o.ast, ack: true }); // write
            this.setState("allow_charging",                     { val: o.alw, ack: true }); // write
            this.setState("stop_state",                         { val: o.stp, ack: true }); // write
        });

        // Write energy related Stuff
        await (o => {
            this.setState("phases",                             { val: o.pha, ack: true }); // read
            // Split phases in single states
            this.setState("energy.phase1.preContactorActive",   { val: ((parseInt(o.pha) & preContactorPhase1) == preContactorPhase1)}); //read
            this.setState("energy.phase1.postContactorActive",   { val: ((parseInt(o.pha) & postContactorPhase1) == postContactorPhase1)}); //read
            this.setState("energy.phase2.preContactorActive",   { val: ((parseInt(o.pha) & preContactorPhase2) == preContactorPhase2)}); //read
            this.setState("energy.phase2.postContactorActive",   { val: ((parseInt(o.pha) & postContactorPhase2) == postContactorPhase2)}); //read
            this.setState("energy.phase3.preContactorActive",   { val: ((parseInt(o.pha) & preContactorPhase3) == preContactorPhase3)}); //read
            this.setState("energy.phase3.postContactorActive",   { val: ((parseInt(o.pha) & postContactorPhase3) == postContactorPhase3)}); //read
            this.setState("energy.phase1.voltage",              { val: o.nrg[0], ack: true }); // read
            this.setState("energy.phase2.voltage",              { val: o.nrg[1], ack: true }); // read
            this.setState("energy.phase3.voltage",              { val: o.nrg[2], ack: true }); // read
        
        });
        // Energy part 2
        await(o => {
            this.setState("energy.neutral.voltage",             { val: o.nrg[3], ack: true }); // read
            this.setState("energy.phase1.ampere",               { val: (o.nrg[4] / 10), ack: true }); // read
            this.setState("energy.phase2.ampere",               { val: (o.nrg[5] / 10), ack: true }); // read
            this.setState("energy.phase3.ampere",               { val: (o.nrg[6] / 10), ack: true }); // read
            this.setState("energy.phase1.power",                { val: (o.nrg[7] / 10), ack: true }); // read
            this.setState("energy.phase2.power",                { val: (o.nrg[8] / 10), ack: true }); // read
            this.setState("energy.phase3.power",                { val: (o.nrg[9] / 10), ack: true }); // read
            this.setState("energy.neutral.power",               { val: (o.nrg[10] / 10), ack: true }); // read
        });

        // Enery part 3
        await(o => {
            this.setState("energy.power",                       { val: (o.nrg[11] / 100), ack: true }); // read
            this.setState("energy.phase1.power_coefficient",    { val: o.nrg[12], ack: true }); // read
            this.setState("energy.phase2.power_coefficient",    { val: o.nrg[13], ack: true }); // read
            this.setState("energy.phase3.power_coefficient",    { val: o.nrg[14], ack: true }); // read
            this.setState("energy.neutral.power_coefficient",   { val: o.nrg[15], ack: true }); // read
            this.setState("cable_ampere_code",                  { val: o.cbl, ack: true }); // read
            this.setState("avail_ampere",                       { val: o.amt, ack: true });
            this.setState("energy_total",                       { val: (o.eto / 10), ack: true }); // read
        
        });

        // 
        // Wifi
        await (o => {
            this.setState("wifi.state",                         { val: o.wst, ack: true }); // read
            this.setState("transmit_interface",                 { val: o.txi, ack: true });
            this.setState("wifi.ssid",                          { val: o.wss, ack: true }); // write
            this.setState("wifi.key",                           { val: o.wke, ack: true }); // write
            this.setState("wifi.enabled",                       { val: o.wen, ack: true }); // write
            this.setState("cloud_disabled",                     { val: o.cdi, ack: true });
            this.setState("wifi.hotspot_key",                   { val: o.wak, ack: true }); // write
            this.setState("http_flags",                         { val: o.r1x, ack: true }); // write
            
        });

        // Scheduling Block
        await(o => {
            this.setState("loaded_energy",                      { val: o.dws, ack: true }); // read
            this.setState("max_load",                           { val: (o.dwo / 10), ack: true }); // write
            this.setState("electricity_exchange.min_hours",     { val: o.aho, ack: true }); // write
            this.setState("electricity_exchange.finish_hour",   { val: o.afi, ack: true }); // write
            this.setState("electricity_exchange.price_zone",    { val: o.azo, ack: true });
            this.setState("max_ampere",                         { val: o.ama, ack: true });
            
        });

        // Hardware Parameters
        await(o => {
            this.setState("firmware_version",                   { val: o.fwv, ack: true }); // read
            this.setState("serial_number",                      { val: o.sse, ack: true }); // read
            this.setState("led_brightness",                     { val: o.lbr, ack: true }); // write
            this.setState("ampere_level1",                      { val: o.al1, ack: true }); // write
            this.setState("ampere_level2",                      { val: o.al2, ack: true }); // write
            this.setState("ampere_level3",                      { val: o.al3, ack: true }); // write
            this.setState("ampere_level4",                      { val: o.al4, ack: true }); // write
            this.setState("ampere_level5",                      { val: o.al5, ack: true }); // write
            this.setState("color.idle",                         { val: "#" + ("000000" + parseInt(o.cid).toString(16)).slice(6), ack: true }); // write
            this.setState("color.charging",                     { val: "#" + ("000000" + parseInt(o.cch).toString(16)).slice(6), ack: true }); // write
            this.setState("color.finish",                       { val: "#" + ("000000" + parseInt(o.cfi).toString(16)).slice(6), ack: true }); // write
            
        });

        // TimeZone
        await(o => {
            this.setState("time_offset",                        { val: o.tof, ack: true}); // write
            this.setState("time_daylight_saving",               { val: o.tds, ack: true }); // write
            
        });

        // RFID Badges
        await (o => {
            this.setState("rfid.badges.1.consumption",          { val: o.eca, ack: true }); // read
            this.setState("rfid.badges.2.consumption",          { val: o.ecr, ack: true }); // read
            this.setState("rfid.badges.3.consumption",          { val: o.ecd, ack: true }); // read
            this.setState("rfid.badges.4.consumption",          { val: o.ec4, ack: true }); // read
            this.setState("rfid.badges.5.consumption",          { val: o.ec5, ack: true }); // read
            this.setState("rfid.badges.6.consumption",          { val: o.ec6, ack: true }); // read
            this.setState("rfid.badges.7.consumption",          { val: o.ec7, ack: true }); // read
            this.setState("rfid.badges.8.consumption",          { val: o.ec8, ack: true }); // read
            this.setState("rfid.badges.9.consumption",          { val: o.ec9, ack: true }); // read
            this.setState("rfid.badges.10.consumption",         { val: o.ec1, ack: true }); // read    
        });

        // RFID ID
        await(o => {
            this.setState("rfid.badges.1.id",                   { val: o.rca, ack: true }); // read
            this.setState("rfid.badges.2.id",                   { val: o.rcr, ack: true }); // read
            this.setState("rfid.badges.3.id",                   { val: o.rcd, ack: true }); // read
            this.setState("rfid.badges.4.id",                   { val: o.rc4, ack: true }); // read
            this.setState("rfid.badges.5.id",                   { val: o.rc5, ack: true }); // read
            this.setState("rfid.badges.6.id",                   { val: o.rc6, ack: true }); // read
            this.setState("rfid.badges.7.id",                   { val: o.rc7, ack: true }); // read
            this.setState("rfid.badges.8.id",                   { val: o.rc8, ack: true }); // read
            this.setState("rfid.badges.9.id",                   { val: o.rc9, ack: true }); // read
            this.setState("rfid.badges.10.id",                  { val: o.rc1, ack: true }); // read
            
        });

        // RFID Name 
        await(o => {
            this.setState("rfid.badges.1.name",                 { val: o.rna, ack: true }); // write
            this.setState("rfid.badges.2.name",                 { val: o.rnr, ack: true }); // write
            this.setState("rfid.badges.3.name",                 { val: o.rnd, ack: true }); // write
            this.setState("rfid.badges.4.name",                 { val: o.rn4, ack: true }); // write
            this.setState("rfid.badges.5.name",                 { val: o.rn5, ack: true }); // write
            this.setState("rfid.badges.6.name",                 { val: o.rn6, ack: true }); // write
            this.setState("rfid.badges.7.name",                 { val: o.rn7, ack: true }); // write
            this.setState("rfid.badges.8.name",                 { val: o.rn8, ack: true }); // write
            this.setState("rfid.badges.9.name",                 { val: o.rn9, ack: true }); // write
            this.setState("rfid.badges.10.name",                { val: o.rn1, ack: true }); // write
        
        });
        // MQTT Block
        await(o => {
            this.setState("mqtt.enabled",                       { val: o.mce, ack: true });
            this.setState("mqtt.server",                        { val: o.mcs, ack: true });
            this.setState("mqtt.port",                          { val: o.mcp, ack: true });
            this.setState("mqtt.user",                          { val: o.mcu, ack: true });
            this.setState("mqtt.key",                           { val: o.mck, ack: true });
            this.setState("mqtt.connection",                    { val: o.mcc, ack: true });
        });
        this.setState("tempereature",                       { val: o.tmp, ack: true }); // read
        this.setState("tempereatureArray",                  { val: o.tma, ack: true });
        this.setState("adapter_in",                         { val: o.adi, ack: true }); // read
        this.setState("unlocked_by",                        { val: o.uby, ack: true }); // read
        this.setState("led_save_energy",                    { val: o.lse, ack: true }); // write
        this.setState("unlock_state",                       { val: o.ust, ack: true }); // write
        this.setState("electricity_exchange.balance_time",  { val: o.dto, ack: true }); // write
        this.setState("energy.norway_mode",                 { val: o.nmo, ack: true }); // write
        this.setState("scheduler_settings",                 { val: o.sch, ack: true });
        this.setState("scheduler_double_press",             { val: o.sdp, ack: true });
        
    }
    /**
     * 
     * @param {string} id 
     * @param {string | number | boolean} value 
     */
    setValue(id, value) {
        this.log.info("Set value " + value + " of id " + id);
        axios.get("http://" + this.config.serverName + "/mqtt?payload=" + id + "=" + value)
            .then(o => {
                this.log.info(o.status + " with message: " + o.statusText);
                this.processStatusObject(o.data);
            })
            .catch(err => {
                this.log.error(err.message + " at " + id + " / " + value);
            });
    }
    /**
     * Set the maximum ampere level to the device. But not Updates it more than x seconds. Setting ampUpdateInterval
     * @param {number} watts
     */
    async updateAmpLevel(watts) {
        if (!this.ampTimer) {
            this.ampTimer = setTimeout(() => {
                this.ampTimer = null;
            }, this.config.ampUpdateInterval * 1000);
            try {
                // San for active phases on Adapter
                const prePhase1 = await this.getStateAsync("energy.phase1.preContactorActive");
                const prePhase2 = await this.getStateAsync("energy.phase2.preContactorActive");
                const prePhase3 = await this.getStateAsync("energy.phase3.preContactorActive");
                const avgVoltage1 = await this.getStateAsync("energy.phase1.voltage");
                const avgVoltage2 = await this.getStateAsync("energy.phase2.voltage");
                const avgVoltage3 = await this.getStateAsync("energy.phase3.voltage");

                if(prePhase1 === null || prePhase1 === undefined || prePhase1.val === null ||  
                   prePhase2 === null || prePhase2 === undefined || prePhase2.val === null ||  
                   prePhase3 === null || prePhase3 === undefined || prePhase3.val === null ||  
                   avgVoltage1 === null || avgVoltage1 === undefined || avgVoltage1.val === null ||
                   avgVoltage2 === null || avgVoltage2 === undefined || avgVoltage2.val === null ||
                   avgVoltage3 === null || avgVoltage3 === undefined || avgVoltage3.val === null) {
                    return;
                }

                const maxAmp = Math.round(((prePhase1.val === true ? parseInt(avgVoltage1.val.toString()) : 0 ) + 
                                (prePhase2.val === true ? parseInt(avgVoltage2.val.toString()) : 0 ) + 
                                (prePhase3.val === true ? parseInt(avgVoltage3.val.toString()) : 0 ) )/watts);
                if(maxAmp < 6) {
                    // The smallest value is 6 amperes
                    this.setValue("amp", 6);
                    this.log.debug("set maxAmperes by maxWatts: 6 amperes with " + watts + " watts");
                } else if(maxAmp < 32) {
                    this.setValue("amp", maxAmp);
                    this.log.debug("set maxAmperes by maxWatts: " + maxAmp + " with " + watts + " watts");
                } else {
                    // The maximum is 32 Amperes
                    this.setValue("amp", 32);
                    this.log.debug("set maxAmperes by maxWatts: 32 with " + watts + " watts");
                }
            } catch (e) {
                this.log.error("Error during set MaxWatts: " + e.message);
            }
        }
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new GoE(options);
} else {
    // otherwise start the instance directly
    new GoE();
}