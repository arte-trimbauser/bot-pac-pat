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
import { sendLog } from "./logs.js";

const cooldown = new Set();

export async function createTicket(interaction, type, label, client) {
  const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
  if (!guild) {
    return safeEditReply(interaction, {
      content: "❌ Erro: Não consegui aceder ao servidor principal.",
      flags: 64,
    });
  }
  const user = interaction.user;

  if (cooldown.has(user.id)) {
    return safeEditReply(interaction, {
      content: "⏳ Espera um pouco antes de abrir outro ticket (3 segundos).",
      flags: 64,
    });
  }

  const existingTicket = Object.values(db.tickets).find(
    (t) => t.userId === user.id && !t.closed,
  );
  if (existingTicket) {
    const existingChannel = await guild.channels
      .fetch(existingTicket.channelId)
      .catch(() => null);
    if (existingChannel) {
      return safeEditReply(interaction, {
        content: "❌ Já tens um ticket aberto!",
        flags: 64,
      });
    } else {
      existingTicket.closed = true;
      existingTicket.closedAt = new Date().toISOString();
      existingTicket.closedBy = "Sistema (Canal Apagado)";
      existingTicket.closedByName = "Sistema";
      saveDB();
    }
  }

  cooldown.add(user.id);
  setTimeout(() => cooldown.delete(user.id), 3000);

  const channelName = `ticket-${user.username}-${user.id.slice(0, 4)}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .substring(0, 25);

  let categoria = CONFIG.CATEGORIA_TICKETS_GERAL;
  if (type === "recrutamento" || type === "ajuda") {
    categoria = CONFIG.CATEGORIA_TICKETS_RECRUTAMENTO;
  }

  if (categoria) {
    const categoriaExiste = await guild.channels.fetch(categoria).catch(() => null);
    if (!categoriaExiste) {
      console.log(`⚠️ Categoria ${categoria} não encontrada, criando sem categoria...`);
      categoria = null;
    }
  }

  let staffRoleId = CONFIG.CARGO_STAFF;
  try {
    const staffRole = await guild.roles.fetch(CONFIG.CARGO_STAFF).catch(() => null);
    if (staffRole) staffRoleId = staffRole.id;
  } catch (e) {
    console.log("⚠️ Não foi possível fetch o cargo staff");
  }

  const channelData = {
    name: channelName,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      {
        id: guild.id,
        type: 0,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        type: 1,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: staffRoleId,
        type: 0,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
  };

  if (categoria) {
    channelData.parent = categoria;
  }

  const channel = await guild.channels.create(channelData);

  const ticketId = Date.now().toString();
  db.tickets[ticketId] = {
    id: ticketId,
    channelId: channel.id,
    userId: user.id,
    username: user.username,
    type: type,
    label: label,
    openedAt: new Date().toISOString(),
    closedAt: null,
    claimedBy: null,
    claimedByName: null,
    closedBy: null,
    closedByName: null,
    callActive: false,
    callChannelId: null,
    rating: null,
    panelMessageId: null,
    recrutado: null,
    fotoNome: null,
  };
  saveDB();

  const embed = new EmbedBuilder()
    .setTitle("🎫 Sistema de Ticket | Portugal Alfa Truckers")
    .setDescription(
      `📋 **Motivo:** ${label}\n` +
      `🔧 **Assumido:** Aguardando staff...\n\n` +
      `👋 Olá, aguarde ser atendido. Um membro da staff irá assumir o teu ticket brevemente.\n\n` +
      `⚠️ **Lembre-se:** Qualquer descumprimento das regras levará ao encerramento do ticket sem aviso prévio!`
    )
    .setColor(0x262af1);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`assumir_${ticketId}`)
      .setLabel("✅ Assumir")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`painel_${ticketId}`)
      .setLabel("🛡️ Painel Staff")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`sair_${ticketId}`)
      .setLabel("🚪 Sair")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`deletar_${ticketId}`)
      .setLabel("🗑️ Deletar")
      .setStyle(ButtonStyle.Danger),
  );

  const panelMsg = await channel.send({
    content: `<@${user.id}>`,
    embeds: [embed],
    components: [row],
  });
  db.tickets[ticketId].panelMessageId = panelMsg.id;
  saveDB();

  await sendLog(ticketId, "open", client);

  const ticketGuildId = CONFIG.GUILD_ID;
  const rowIrTicket = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Ir para o Ticket")
      .setStyle(ButtonStyle.Link)
      .setURL(
        `https://discord.com/channels/${ticketGuildId}/${channel.id}`,
      ),
  );

  await safeEditReply(interaction, {
    content: `✅ O teu ticket foi criado com sucesso! Podes aceder aqui:`,
    components: [rowIrTicket],
    flags: 64,
  });
}

export async function updateTicketEmbed(channel, ticketId) {
  const ticket = db.tickets[ticketId];
  if (!ticket || !ticket.panelMessageId) return;

  try {
    const panelMsg = await channel.messages.fetch(ticket.panelMessageId);
    if (!panelMsg) return;

    const claimedText = ticket.claimedBy
      ? `<@${ticket.claimedBy}> | ${ticket.claimedByName}`
      : "Aguardando staff...";

    const embed = new EmbedBuilder()
      .setTitle("🎫 Sistema de Ticket | Portugal Alfa Community")
      .setDescription(
        `📋 **Motivo:** ${ticket.label}\n` +
        `🔧 **Assumido:** ${claimedText}\n\n` +
        `👋 Olá, aguarde ser atendido. Um membro da staff irá assumir o teu ticket brevemente.\n\n` +
        `⚠️ **Lembre-se:** Qualquer descumprimento das regras levará ao encerramento do ticket sem aviso prévio!`
      )
      .setColor(0x040021);

    if (ticket.claimedBy) {
      const oldComponents = panelMsg.components;
      if (oldComponents && oldComponents[0]) {
        const newRow = new ActionRowBuilder();
        const oldButtons = oldComponents[0].components;

        for (const btn of oldButtons) {
          const newBtn = ButtonBuilder.from(btn);
          if (btn.customId && btn.customId.startsWith("assumir_")) {
            newBtn.setDisabled(true);
            newBtn.setLabel("✅ Assumido");
          }
          newRow.addComponents(newBtn);
        }

        await panelMsg.edit({ embeds: [embed], components: [newRow] });
        return;
      }
    }

    await panelMsg.edit({ embeds: [embed] });
  } catch (e) {
    console.log("Erro ao atualizar embed:", e);
  }
}
