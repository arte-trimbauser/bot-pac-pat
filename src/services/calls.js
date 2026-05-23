import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { safeEditReply } from "../utils/safeReply.js";

export async function sendPainelChamada(channel, ticketId, interaction) {
    const ticket = db.tickets[ticketId];

    const embed = new EmbedBuilder()
        .setTitle("📞 Painel de Chamada")
        .setDescription(
            `• Olá 👋, Selecione a opção desejada abaixo.

` +
            `**Chamada**
` +
            `${ticket.callActive ? "🟢 Em andamento" : "🔴 Não iniciado"}`
        )
        .setColor(0x262af1);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`criar_call_${ticketId}`)
            .setLabel("🔵 Criar Call")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`apagar_call_${ticketId}`)
            .setLabel("🔴 Apagar Call")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`add_user_${ticketId}`)
            .setLabel("➕ Adicionar Usuário")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`remove_user_${ticketId}`)
            .setLabel("➖ Remover Usuário")
            .setStyle(ButtonStyle.Secondary),
    );

    if (interaction) {
        await safeEditReply(interaction, {
            embeds: [embed],
            components: [row],
            flags: 64,
        });
    } else {
        await channel.send({ embeds: [embed], components: [row] });
    }
}

export async function criarCall(interaction, ticketId, client) {
    const ticket = db.tickets[ticketId];
    if (!ticket) return;

    let existingCall = null;
    if (ticket.callChannelId) {
        existingCall = await interaction.guild.channels
            .fetch(ticket.callChannelId)
            .catch(() => null);
    }

    if (ticket.callActive && existingCall) {
        return safeEditReply(interaction, {
            content: "❌ Já existe uma call ativa.",
            flags: 64,
        });
    }

    const callData = {
        name: `call-${ticket.username}`,
        type: ChannelType.GuildVoice,
        parent: interaction.channel.parentId || undefined,
        permissionOverwrites: [
            {
                id: interaction.guild.id,
                type: 0,
                deny: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.Connect,
                ],
            },
            {
                id: ticket.userId,
                type: 1,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.Connect,
                    PermissionFlagsBits.Speak,
                ],
            },
            {
                id: CONFIG.CARGO_STAFF,
                type: 0,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.Connect,
                    PermissionFlagsBits.Speak,
                ],
            },
        ],
    };

    if (!callData.parent) delete callData.parent;
    const channel = await interaction.guild.channels.create(callData);

    ticket.callActive = true;
    ticket.callChannelId = channel.id;
    saveDB();

    await safeEditReply(interaction, {
        content: `🔵 Call criada: ${channel}`,
        flags: 64,
    });
}

export async function apagarCall(interaction, ticketId, client) {
    const ticket = db.tickets[ticketId];
    if (!ticket || !ticket.callActive) {
        return safeEditReply(interaction, {
            content: "❌ Não existe call ativa.",
            flags: 64,
        });
    }

    const mainGuild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    if (!mainGuild) {
        return safeEditReply(interaction, {
            content: "❌ Erro: Não consegui aceder ao servidor principal.",
            flags: 64,
        });
    }

    const callChannel = await mainGuild.channels
        .fetch(ticket.callChannelId)
        .catch(() => null);
    if (callChannel) await callChannel.delete();

    ticket.callActive = false;
    ticket.callChannelId = null;
    saveDB();

    await safeEditReply(interaction, { content: "🔴 Call apagada.", flags: 64 });
}
