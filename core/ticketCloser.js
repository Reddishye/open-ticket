const discord = require('discord.js')
const bot = require('../index')
const client = bot.client
const config = require("../config.json")

const ticketStorage = bot.TicketStorage
const userTicketStorage = bot.userTicketStorage
const transcriptStorage = bot.transcriptStorage

/**
 * 
 * @param {discord.Interaction} interaction
 * @param {String} prefix
 * @param {"delete"|"close"|"deletenotranscript"} mode
 */
exports.closeTicket = async (interaction,prefix,mode) => {
    const channelmessages = await interaction.channel.messages.fetch()

    channelmessages.sweep((msgSweep) => {
        return msgSweep.author.id == client.user.id
    })

    /**
     * @type {String} ticketuserarray
     */
    const ticketuserarray = interaction.channel.name
    const ticketusername = ticketuserarray.split(prefix)[1]

    var getuserID = userTicketStorage.getItem(interaction.channel.id)
    var getusernameStep1 = client.users.cache.find(u => u.id === getuserID)

    var enableTranscript = true

    if (mode == "delete"){
        interaction.channel.delete()
        if (config.logs){console.log("[system] deleted a ticket (name:"+interaction.channel.name+",user:"+interaction.user.username+")")}

        ticketStorage.setItem(getuserID,Number(ticketStorage.getItem(getuserID)) - 1)
    }else if (mode == "close"){
        var permissionArray = []
        permissionArray.push({
            id:getusernameStep1.id,
            type:"member",
            allow:["VIEW_CHANNEL"],
            deny:["ADD_REACTIONS","ATTACH_FILES","EMBED_LINKS","SEND_MESSAGES"]
        })

        permissionArray.push({
            id:interaction.guild.id,
            type:"role",
            deny:["ADD_REACTIONS","ATTACH_FILES","EMBED_LINKS","SEND_MESSAGES","VIEW_CHANNEL"]
        })

        interaction.channel.permissionOverwrites.set(permissionArray)

        //message
        var closeButtonRow = new discord.MessageActionRow()
            .addComponents(
                new discord.MessageButton()
                .setCustomId("deleteTicket1")
                .setDisabled(false)
                .setStyle("DANGER")
                .setLabel("Delete Ticket")
                .setEmoji("❌")
            )
            .addComponents(
                new discord.MessageButton()
                .setCustomId("sendTranscript")
                .setDisabled(false)
                .setStyle("SECONDARY")
                .setLabel("Send Transcript File")
                .setEmoji("📄")
            )
        const embed = new discord.MessageEmbed()
            .setColor(config.main_color)
            .setTitle("Closed this ticket!")
            .setDescription("Only admins can now talk in this ticket!\n\n*Click on the button below to delete this ticket*")
        interaction.channel.send({embeds:[embed],components:[closeButtonRow]})
    }else if (mode == "deletenotranscript"){
        enableTranscript = false
        interaction.channel.delete()
        if (config.logs){console.log("[system] deleted a ticket (name:"+interaction.channel.name+",user:"+interaction.user.username+")")}

        ticketStorage.setItem(getuserID,Number(ticketStorage.getItem(getuserID)) - 1)
    }

    if (enableTranscript == true && mode != "deletenotranscript"){

        if (config.system.enable_transcript || config.system.enable_DM_transcript){
            var fileattachment = await require("./transcript").createTranscript(channelmessages)

            if (fileattachment == false){console.log("[transcript] internal error: no transcript is created!");return}
        }

        if (getusernameStep1 == null || getusernameStep1 == undefined || getusernameStep1 == false || getusernameStep1 == ""){
            var getuserNAME = ":usernotfound:"
        }else {
            var getuserNAME = getusernameStep1.username
        }
                    
        if (config.system.enable_transcript){
            const transcriptEmbed = new discord.MessageEmbed()
                .setColor(config.main_color)
                .setTitle("A new transcript is here!")
                .setAuthor({name:interaction.user.username,iconURL:interaction.user.displayAvatarURL({format:"png"})})
                .setDescription("You can find the transcript in the text file above!")
                .setFooter({text:"ticket: "+ticketuserarray})
            
            interaction.guild.channels.cache.find(c => c.id == config.system.transcript_channel).send({
                embeds:[transcriptEmbed],
                files:[fileattachment]
            })
        }

        if (config.system.enable_DM_transcript){
            const transcriptEmbed = new discord.MessageEmbed()
                .setColor(config.main_color)
                .setTitle("Here is a transcript of your ticket!")
                .setDescription("You can find the transcript in the text file above!")
                .setFooter({text:"ticket: "+ticketuserarray})
            
            getusernameStep1.send({
                embeds:[transcriptEmbed],
                files:[fileattachment]
            })
        }
    }
}

exports.runThis = () => {
    client.on("interactionCreate",async (interaction) => {
        if (!interaction.isButton()) return
        if (interaction.customId != "sendTranscript") return

        interaction.deferUpdate()

        const channelmessages = await interaction.channel.messages.fetch()

        channelmessages.sweep((msgSweep) => {
            return msgSweep.author.id == client.user.id
        })

        var fileattachment = await require("./transcript").createTranscript(channelmessages)

        if (fileattachment == false){
            console.log("[transcript] internal error: no transcript is created!")
            interaction.channel.send({content:"**Something went wrong while making the transcript!**\nPlease try again another time!"})
            return
        }

        interaction.channel.send({content:"**Here is the transcript:**",files:[fileattachment]})
    })
}