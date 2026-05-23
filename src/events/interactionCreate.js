import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { safeDeferReply, safeEditReply } from "../utils/safeReply.js";
import { updateTicketEmbed } from "../services/tickets.js";
import { sendPainelChamada, criarCall, apagarCall } from "../services/calls.js";
import { sendLog, enviarLogAvaliacao, enviarAvaliacaoDM } from "../services/logs.js";
import { handleAjudaCommand, handleAjudaProcurar, handleAjudaModal, assistantMemory } from "../services/ajuda.js";

export async function handleInteractionCreate(interaction, client) {
    // ========== MODAL SUBMIT ==========
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith("modal_avaliar_")) {
            const parts = interaction.customId.split("_");
            const ticketId = parts[2];
            const estrelas = parseInt(parts[3]);
            const ticket = db.tickets[ticketId];

            if (!ticket) {
                return interaction.reply({
                    content: "❌ Ticket não encontrado.",
                    flags: 64,
                });
            }

            const mensagem = interaction.fields.getTextInputValue("mensagem_avaliacao") || "";

            const deferred = await safeDeferReply(interaction, { flags: 64 });
            if (!deferred) return;

            await enviarLogAvaliacao(ticket, estrelas, mensagem, interaction.user, client);

            if (!db.avaliacoes[ticketId]) {
                db.avaliacoes[ticketId] = [];
            }
            db.avaliacoes[ticketId].push({
                estrelas: estrelas,
                mensagem: mensagem,
                data: new Date().toISOString(),
                avaliador: interaction.user.id,
            });
            saveDB();

            await safeEditReply(interaction, {
                content: `✅ Obrigado pela sua avaliação de ${estrelas} estrelas!`,
                flags: 64,
            });
            return;
        }

        if (interaction.customId === "modal_ajuda") {
            await handleAjudaModal(interaction, client);
            return;
        }
    }

    // ========== COMANDOS DE BARRA ==========
    if (interaction.isChatInputCommand()) {
        // /apagar
        if (interaction.commandName === "apagar") {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: "❌ Apenas administradores podem usar este comando.",
                    flags: 64,
                });
            }

            const canaisInput = interaction.options.getString("canais");
            const guild = interaction.guild;

            let canaisParaApagar = [];

            if (canaisInput) {
                const ids = canaisInput.split(",").map((id) => id.trim());
                for (const id of ids) {
                    const canal = await guild.channels.fetch(id).catch(() => null);
                    if (canal) canaisParaApagar.push(canal);
                }
            } else {
                canaisParaApagar = guild.channels.cache
                    .filter((ch) => ch.type === 0) // GuildText
                    .map((ch) => ch);
            }

            await interaction.reply({
                content: `🗑️ A apagar mensagens em ${canaisParaApagar.length} canais...`,
                flags: 64,
            });

            let totalApagadas = 0;
            const erros = [];

            for (const canal of canaisParaApagar) {
                try {
                    const messages = await canal.messages.fetch({ limit: 100 });
                    const botMessages = messages.filter(
                        (msg) => msg.author.id === client.user.id,
                    );

                    for (const msg of botMessages.values()) {
                        await msg.delete().catch(() => {});
                        totalApagadas++;
                        await new Promise((resolve) => setTimeout(resolve, 100));
                    }
                } catch (e) {
                    erros.push(`${canal.name}: ${e.message}`);
                }
            }

            if (!canaisInput) {
                db.messages = {};
            } else {
                const ids = canaisInput.split(",").map((id) => id.trim());
                for (const id of ids) {
                    if (db.messages.painelGeral && id === CONFIG.CANAL_TICKETS_GERAL)
                        delete db.messages.painelGeral;
                    if (db.messages.painelRecrutamento && id === CONFIG.CANAL_TICKETS_RECRUTAMENTO)
                        delete db.messages.painelRecrutamento;
                    if (db.messages.painelRegras && id === CONFIG.CANAL_REGRAS)
                        delete db.messages.painelRegras;
                    if (db.messages.painelRegrasRecrutamento && id === CONFIG.CANAL_REGRAS_RECRUTAMENTO)
                        delete db.messages.painelRegrasRecrutamento;
                }
            }
            saveDB();

            let resposta = `✅ **Limpeza concluída!**
`;
            resposta += `🗑️ Total de mensagens apagadas: **${totalApagadas}**
`;
            if (erros.length > 0) {
                resposta += `⚠️ Erros em ${erros.length} canais
`;
            }
            resposta += `
💡 **Dica:** Use os comandos manuais para reenviar painéis.`;

            await safeEditReply(interaction, { content: resposta });
            return;
        }

        // /ajuda
        if (interaction.commandName === "ajuda") {
            await handleAjudaCommand(interaction, client);
            return;
        }

        // /limpar
        if (interaction.commandName === "limpar") {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({
                    content: "❌ Não tens permissão para usar este comando.",
                    flags: 64,
                });
            }

            const quantidade = interaction.options.getInteger("quantidade");
            const motivo = interaction.options.getString("motivo") || "Sem motivo especificado";

            await interaction.deferReply({ flags: 64 });

            const messages = await interaction.channel.messages.fetch({ limit: quantidade });

            // Save transcript before deleting
            const transcriptData = messages.map(m => ({
                author: m.author.tag,
                content: m.content,
                timestamp: m.createdTimestamp,
                attachments: m.attachments.map(a => a.url)
            }));

            // Delete messages
            for (const msg of messages.values()) {
                if (msg.deletable) {
                    await msg.delete().catch(() => {});
                }
            }

            await interaction.editReply({
                content: `✅ **${quantidade} mensagens apagadas!**
📝 Motivo: ${motivo}
📄 Transcript guardado no sistema.`,
                flags: 64
            });
            return;
        }

        // /status
        if (interaction.commandName === "status") {
            const embed = new EmbedBuilder()
                .setTitle("📊 Status do Bot")
                .setDescription(
                    `🤖 **Bot:** ${client.user.tag}
` +
                    `📡 **Ping:** ${client.ws.ping}ms
` +
                    `🎫 **Tickets abertos:** ${Object.values(db.tickets).filter(t => !t.closed).length}
` +
                    `👥 **Membros:** ${interaction.guild.memberCount}
` +
                    `⏰ **Online desde:** <t:${Math.floor(client.readyTimestamp / 1000)}:R>`
                )
                .setColor(0x00ff00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }

        return;
    }

    // ========== SELECT MENUS ==========
    if (interaction.isStringSelectMenu()) {
        const deferred = await safeDeferReply(interaction, { flags: 64 });
        if (!deferred) return;

        if (interaction.customId === "ticket_geral") {
            const type = interaction.values[0];
            const labels = {
                bugs: `${CONFIG.EMOJI_BUGS} Bugs`,
                denuncia: `${CONFIG.EMOJI_DENUNCIA} Denúncia`,
                suporte: `${CONFIG.EMOJI_SUPORTE} Suporte`,
                criador: `${CONFIG.EMOJI_CRIADOR} Criador De Conteudo`,
            };
            const { createTicket } = await import("../services/tickets.js");
            await createTicket(interaction, type, labels[type], client);
        } else if (interaction.customId === "ticket_recrutamento") {
            const type = interaction.values[0];
            const labels = {
                recrutamento: `${CONFIG.EMOJI_RECRUTAMENTO} Recrutamento PAT`,
                ajuda: `${CONFIG.EMOJI_AJUDA} Pedir ajuda`,
            };
            const { createTicket } = await import("../services/tickets.js");
            await createTicket(interaction, type, labels[type], client);
        }
        return;
    }

    // ========== BUTTONS ==========
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // ===== SISTEMA /AJUDA - BOTÕES =====
        if (customId === "ajuda_procurar") {
            await handleAjudaProcurar(interaction);
            return;
        }
        if (customId === "ajuda_ticket") {
            await interaction.reply({
                content: `🎫 Abre um ticket aqui: <#${CONFIG.CANAL_TICKETS_GERAL}>`,
                flags: 64
            });
            return;
        }
        if (customId === "ajuda_nova") {
            await handleAjudaCommand(interaction, client);
            return;
        }

        // ===== ASSISTENTE INTELIGENTE - BOTÕES =====
        if (customId.startsWith("smart_helpful_")) {
            await interaction.update({
                content: interaction.message.content + "
✅ O utilizador confirmou que resolveu!",
                components: [],
                embeds: interaction.message.embeds
            });
            return;
        }

        if (customId.startsWith("smart_not_helpful_")) {
            await interaction.update({
                content: "❌ O utilizador indicou que não resolveu. Staff pode ajudar!",
                components: []
            });
            return;
        }

        if (customId.startsWith("smart_search_")) {
            await interaction.update({
                content: "🔍 A pesquisar na internet... (funcionalidade em desenvolvimento)",
                components: []
            });
            return;
        }

        if (customId.startsWith("smart_do_search_")) {
            await interaction.update({
                content: "🔍 A pesquisar na internet... (funcionalidade em desenvolvimento)",
                components: []
            });
            return;
        }

        if (customId === "smart_cancel") {
            await interaction.update({
                content: "❌ Pesquisa cancelada.",
                components: []
            });
            return;
        }

        // ===== BOTÕES EXISTENTES (TICKETS, REGRAS, ETC) =====
        // Aceitar Regras
        if (customId === "aceitar_regras") {
            const deferred = await safeDeferReply(interaction, { flags: 64 });
            if (!deferred) return;

            const member = interaction.member;
            const userId = member.id;

            const temCargoMembro = member.roles.cache.has(CONFIG.CARGO_MEMBRO) ||
                                   member.roles.cache.has(CONFIG.CARGO_VERIFICADO);
            const jaAceitou = db.acceptedRules.includes(userId);

            if (jaAceitou && temCargoMembro) {
                return safeEditReply(interaction, {
                    content: "✅ Já aceitaste as regras e tens o cargo atribuído!
",
                    flags: 64,
                });
            }

            try {
                const guildId = interaction.guild.id;
                const isRecrutamentoGuild = guildId === CONFIG.GUILD_ID_RECRUTAMENTO;

                let rolesToAdd;
                if (isRecrutamentoGuild) {
                    rolesToAdd = [
                        CONFIG.CARGO_RECRUTAMENTO_1,
                        CONFIG.CARGO_RECRUTAMENTO_2,
                    ];
                } else {
                    rolesToAdd = [
                        CONFIG.CARGO_MEMBRO,
                        CONFIG.CARGO_VERIFICADO,
                    ];
                }

                const rolesAdded = [];
                const rolesFailed = [];

                for (const roleId of rolesToAdd) {
                    if (roleId && roleId !== "ID_CARGO_X") {
                        try {
                            const role = interaction.guild.roles.cache.get(roleId);
                            if (role && !member.roles.cache.has(roleId)) {
                                await member.roles.add(roleId);
                                rolesAdded.push(role.name);
                            }
                        } catch (roleError) {
                            rolesFailed.push(roleId);
                            console.error(`Erro ao adicionar cargo ${roleId}:`, roleError.message);
                        }
                    }
                }

                if (!db.acceptedRules.includes(userId)) {
                    db.acceptedRules.push(userId);
                }
                saveDB();

                let mensagem = "✅ Regras aceites! Bem-vindo à comunidade.";
                if (rolesAdded.length > 0) {
                    mensagem += `
🎉 Cargos atribuídos: ${rolesAdded.join(", ")}`;
                }

                await safeEditReply(interaction, { content: mensagem, flags: 64 });
            } catch (error) {
                console.error("Erro ao aceitar regras:", error);
                await safeEditReply(interaction, {
                    content: "❌ Ocorreu um erro ao processar. Tenta novamente ou contacta a staff.",
                    flags: 64,
                });
            }
            return;
        }

        // Sair do ticket
        if (customId.startsWith("sair_")) {
            const deferred = await safeDeferReply(interaction, { flags: 64 });
            if (!deferred) return;

            const ticketId = customId.split("_")[1];
            const ticket = db.tickets[ticketId];

            if (ticket && ticket.userId === interaction.user.id) {
                await interaction.channel.permissionOverwrites.delete(interaction.user.id);
                await safeEditReply(interaction, {
                    content: "✅ Saíste do ticket. Podes fechá-lo se desejares.",
                    flags: 64,
                });
            } else {
                await safeEditReply(interaction, {
                    content: "❌ Apenas o criador do ticket pode sair.",
                    flags: 64,
                });
            }
            return;
        }

        // Assumir ticket
        if (customId.startsWith("assumir_")) {
            const deferred = await safeDeferReply(interaction, { flags: 64 });
            if (!deferred) return;

            const ticketId = customId.split("_")[1];
            const ticket = db.tickets[ticketId];

            if (!ticket) return;

            const member = interaction.member;
            if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
                return safeEditReply(interaction, {
                    content: "❌ Apenas staff pode assumir tickets.",
                    flags: 64,
                });
            }

            if (ticket.claimedBy) {
                return safeEditReply(interaction, {
                    content: `❌ Este ticket já foi assumido por ${ticket.claimedByName}.`,
                    flags: 64,
                });
            }

            ticket.claimedBy = interaction.user.id;
            ticket.claimedByName = interaction.user.username;
            saveDB();

            await updateTicketEmbed(interaction.channel, ticketId);

            await interaction.channel.send(
                `✅ | ${interaction.user.username} assumiu este ticket.`,
            );

            await sendLog(ticketId, "claim", client);

            await safeEditReply(interaction, {
                content: "✅ Ticket assumido com sucesso!",
                flags: 64,
            });
            return;
        }

        // Painel Staff
        if (customId.startsWith("painel_")) {
            const ticketId = customId.split("_")[1];
            const ticket = db.tickets[ticketId];

            if (!ticket) return;

            const member = interaction.member;
            if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
                return interaction.reply({
                    content: "❌ Apenas staff pode aceder ao painel.",
                    flags: 64,
                });
            }

            const deferred = await safeDeferReply(interaction, { flags: 64 });
            if (!deferred) return;

            await sendPainelChamada(interaction.channel, ticketId, interaction);
            return;
        }

        // DELETAR TICKET
        if (customId.startsWith("deletar_")) {
            const ticketId = customId.split("_")[1];
            const ticket = db.tickets[ticketId];

            if (!ticket) {
                return interaction.reply({
                    content: "❌ Ticket não encontrado.",
                    flags: 64,
                });
            }

            const member = interaction.member;
            if (!member.roles.cache.has(CONFIG.CARGO_STAFF) && ticket.userId !== interaction.user.id) {
                return interaction.reply({
                    content: "❌ Apenas staff ou o criador pode deletar.",
                    flags: 64,
                });
            }

            const deferred = await safeDeferReply(interaction);
            if (!deferred) return;

            const dataFechamento = new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
            const embedFechamento = new EmbedBuilder()
                .setTitle("🎫 Ticket Fechado")
                .setDescription(
                    `Seu ticket foi fechado com sucesso, avalie nosso atendimento enviado no seu privado 😉.

` +
                    `⚒️ **Fechado por:**
<@${interaction.user.id}> | ${interaction.user.username}
` +
                    `🕑 **Fechado em:**
${dataFechamento}

` +
                    `Caso necessário, não hesite em abrir ticket novamente!`
                )
                .setColor(0xFF0000);

            await interaction.channel.send({
                embeds: [embedFechamento],
                content: `<@${ticket.userId}>`
            });

            ticket.closedBy = interaction.user.id;
            ticket.closedByName = interaction.user.username;
            ticket.closedAt = new Date().toISOString();
            ticket.closed = true;
            saveDB();

            await enviarAvaliacaoDM(ticket, client);

            if (ticket.type === "recrutamento") {
                const rowRecrutamento = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`recrutado_sim_${ticketId}`)
                        .setLabel("✅ Sim")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`recrutado_nao_${ticketId}`)
                        .setLabel("❌ Não")
                        .setStyle(ButtonStyle.Danger),
                );

                await interaction.channel.send({
                    content: `**Staff:** O utilizador foi recrutado?`,
                    components: [rowRecrutamento]
                });
            } else {
                await sendLog(ticketId, "close", client);
            }

            await safeEditReply(interaction, {
                content: "🗑️ Ticket será fechado em 10 segundos...",
            });

            setTimeout(async () => {
                await interaction.channel.delete().catch(() => {});
            }, 10000);
            return;
        }

        // AVALIAÇÃO POR ESTRELAS
        if (customId.startsWith("avaliar_")) {
            const parts = customId.split("_");
            const estrelas = parseInt(parts[1]);
            const ticketId = parts[2];
            const ticket = db.tickets[ticketId];

            if (!ticket) {
                return interaction.reply({
                    content: "❌ Ticket não encontrado.",
                    flags: 64,
                });
            }

            if (db.avaliacoes[ticketId] && db.avaliacoes[ticketId].some(a => a.avaliador === interaction.user.id)) {
                return interaction.reply({
                    content: "❌ Já avaliaste este ticket!",
                    flags: 64,
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`modal_avaliar_${ticketId}_${estrelas}`)
                .setTitle(`Avaliação - ${estrelas} Estrelas`);

            const inputMensagem = new TextInputBuilder()
                .setCustomId("mensagem_avaliacao")
                .setLabel("Mensagem (opcional)")
                .setPlaceholder("Deixa uma mensagem sobre o atendimento...")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(500);

            const actionRow = new ActionRowBuilder().addComponents(inputMensagem);
            modal.addComponents(actionRow);

            await interaction.showModal(modal);
            return;
        }

        // Botões de recrutamento
        if (customId.startsWith("recrutado_sim_")) {
            await interaction.deferUpdate();
            const ticketId = customId.split("_")[2];
            const ticket = db.tickets[ticketId];

            if (!ticket) return;

            const mainGuild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
            if (!mainGuild) return;

            const member = await mainGuild.members.fetch(ticket.userId).catch(() => null);
            if (member && CONFIG.CARGO_RECRUTADO) {
                await member.roles.add(CONFIG.CARGO_RECRUTADO).catch(console.error);
            }

            ticket.recrutado = true;
            saveDB();

            const ticketChannel = await mainGuild.channels.fetch(ticket.channelId).catch(() => null);
            if (ticketChannel) {
                await ticketChannel.send(`✅ **Utilizador recrutado com sucesso!**
Cargo ${CONFIG.CARGO_RECRUTADO} atribuído.`);
            }
            await sendLog(ticketId, "close", client);
            return;
        }

        if (customId.startsWith("recrutado_nao_")) {
            await interaction.deferUpdate();
            const ticketId = customId.split("_")[2];
            const ticket = db.tickets[ticketId];

            if (!ticket) return;

            ticket.recrutado = false;
            saveDB();

            const mainGuild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
            if (mainGuild) {
                const ticketChannel = await mainGuild.channels.fetch(ticket.channelId).catch(() => null);
                if (ticketChannel) {
                    await ticketChannel.send(`❌ **Utilizador não foi recrutado.**`);
                }
            }
            await sendLog(ticketId, "close", client);
            return;
        }

        // Criar Call
        if (customId.startsWith("criar_call_")) {
            const deferred = await safeDeferReply(interaction, { flags: 64 });
            if (!deferred) return;

            const ticketId = customId.split("_")[2];
            await criarCall(interaction, ticketId, client);
            return;
        }

        // Apagar Call
        if (customId.startsWith("apagar_call_")) {
            const deferred = await safeDeferReply(interaction, { flags: 64 });
            if (!deferred) return;

            const ticketId = customId.split("_")[2];
            await apagarCall(interaction, ticketId, client);
            return;
        }

        // Adicionar Usuário
        if (customId.startsWith("add_user_")) {
            const ticketId = customId.split("_")[2];
            const ticket = db.tickets[ticketId];

            if (!ticket) return;

            await interaction.reply({
                content: "💡 Para adicionar um usuário, menciona-o neste canal e um staff pode adicionar manualmente nas permissões.",
                flags: 64,
            });
            return;
        }

        // Remover Usuário
        if (customId.startsWith("remove_user_")) {
            const ticketId = customId.split("_")[2];
            const ticket = db.tickets[ticketId];

            if (!ticket) return;

            await interaction.reply({
                content: "💡 Para remover um usuário, um staff pode remover manualmente nas permissões do canal.",
                flags: 64,
            });
            return;
        }
    }
}
