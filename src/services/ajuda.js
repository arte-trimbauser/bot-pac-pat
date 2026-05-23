import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";
import { CONFIG, ASSISTANT_CONFIG } from "../config/index.js";
import { encontrarRespostaFAQ } from "../database/faq.js";
import { encontrarTutorialPAC } from "../database/tutoriais.js";
import { isTopicoPermitido } from "../database/topicos.js";
import { safeEditReply } from "../utils/safeReply.js";

// ==================== MEMÓRIA DO ASSISTENTE ====================
export const assistantMemory = {
    diegoHistory: [],
    userCooldowns: new Map(),
    pendingSearches: new Map(),
    recentHelp: new Map(),

    isOnCooldown(userId) {
        const last = this.userCooldowns.get(userId) || 0;
        return (Date.now() - last) < (ASSISTANT_CONFIG.COOLDOWN * 1000);
    },
    setCooldown(userId) {
        this.userCooldowns.set(userId, Date.now());
    }
};

// ==================== SISTEMA /AJUDA ====================
export async function handleAjudaCommand(interaction, client) {
    const umaHora = 60 * 60 * 1000;
    for (const [uid, data] of assistantMemory.recentHelp.entries()) {
        if (Date.now() - data.timestamp > umaHora) {
            assistantMemory.recentHelp.delete(uid);
        }
    }

    const recentes = Array.from(assistantMemory.recentHelp.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);

    let descricao = "**Bem-vindo à Central de Ajuda da PAC!**
";
    descricao += "Sou o assistente inteligente. Posso ajudar-te com:
";
    descricao += "🎮 **Servidor** — ID, regras, como entrar
";
    descricao += "🚛 **Recrutamento** — Requisitos, Trucky, candidatura
";
    descricao += "⚙️ **ETS2LA** — Configuração, mods, atualizações
";
    descricao += "🥽 **VR** — Meta Quest, tutoriais
";
    descricao += "📲 **Trucky** — Download, instalação
";

    if (recentes.length > 0) {
        descricao += "**📋 Perguntas recentes:**
";
        recentes.forEach((r, i) => {
            const perguntaCurta = r.pergunta.length > 40 ? r.pergunta.substring(0, 40) + "..." : r.pergunta;
            descricao += `\`${i + 1}.\` ${perguntaCurta}
`;
        });
        descricao += "";
    }

    descricao += "Clica em **🔍 Procurar** para fazer a tua pergunta!";

    const embed = new EmbedBuilder()
        .setTitle("🆘 Central de Ajuda - Portugal Alfa")
        .setDescription(descricao)
        .setColor(0x262af1)
        .setThumbnail(CONFIG.IMAGEM_GERAL)
        .setFooter({ text: "Powered by PAC Bot 🤖", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ajuda_procurar")
            .setLabel("🔍 Procurar ajuda")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("ajuda_ticket")
            .setLabel("🎫 Abrir ticket")
            .setStyle(ButtonStyle.Danger)
    );

    if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: 64 });
    }

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

export async function handleAjudaProcurar(interaction) {
    const modal = new ModalBuilder()
        .setCustomId("modal_ajuda")
        .setTitle("🔍 O que precisas?");

    const input = new TextInputBuilder()
        .setCustomId("pergunta_ajuda")
        .setLabel("Descreve o que precisas")
        .setPlaceholder("Ex: como entrar no servidor, configurar ETS2LA, juntar à PAT...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(200);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

export async function handleAjudaModal(interaction, client) {
    const pergunta = interaction.fields.getTextInputValue("pergunta_ajuda").toLowerCase();

    await interaction.deferReply({ flags: 64 });

    // Check if question is about ETS2/ATS/PAC topics
    if (!isTopicoPermitido(pergunta)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Fora do Âmbito")
            .setDescription(
                `Desculpa, mas só posso ajudar com temas relacionados com:

` +
                `🎮 **Euro Truck Simulator 2 / American Truck Simulator**
` +
                `🚛 **Portugal Alfa Truckers / VTC**
` +
                `⚙️ **Mods, Configurações, Tutoriais**
` +
                `📲 **Trucky, TruckersMP, Steam**

` +
                `A tua pergunta parece não estar relacionada com estes temas.

` +
                `💡 **Exemplos do que posso ajudar:**
` +
                `• Como ativar a câmara zero
` +
                `• Como entrar no servidor da PAC
` +
                `• Como instalar mods
` +
                `• Problemas com o Trucky
` +
                `• Configurar VR / ETS2LA

` +
                `Se precisares de ajuda com outro assunto, clica em **🎫 Abrir ticket**.`
            )
            .setColor(0xff0000)
            .setFooter({ text: "Powered by PAC Bot 🤖", iconURL: client.user?.displayAvatarURL() })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ajuda_nova")
                .setLabel("🔄 Nova pergunta")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("ajuda_ticket")
                .setLabel("🎫 Abrir ticket")
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
        return;
    }

    // Check PAC tutorials FIRST (more specific than FAQ)
    const tutorial = encontrarTutorialPAC(pergunta);
    if (tutorial) {
        assistantMemory.recentHelp.set(interaction.user.id, {
            pergunta: pergunta,
            resposta: tutorial.titulo,
            timestamp: Date.now()
        });

        let descricao = `${tutorial.resumo}

`;
        descricao += `👤 **Autor:** ${tutorial.autor}
`;
        descricao += `📌 **Canal:** ${tutorial.canal}

`;
        descricao += `💡 Se ainda tiveres dúvidas, clica em **🎫 Abrir ticket** para falar com a staff.`;

        const embed = new EmbedBuilder()
            .setTitle(tutorial.titulo)
            .setDescription(descricao)
            .setColor(0x9b59b6)
            .setFooter({ text: `Tutorial da PAC 📚 • Por ${tutorial.autor}`, iconURL: client.user?.displayAvatarURL() })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ajuda_nova")
                .setLabel("🔄 Nova pergunta")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("ajuda_ticket")
                .setLabel("🎫 Abrir ticket")
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
        return;
    }

    // Check FAQ second (more general topics)
    const resposta = encontrarRespostaFAQ(pergunta);

    assistantMemory.recentHelp.set(interaction.user.id, {
        pergunta: pergunta,
        resposta: resposta.titulo,
        timestamp: Date.now()
    });

    // If FAQ found a match, show it directly
    if (resposta.found) {
        const embed = new EmbedBuilder()
            .setTitle(resposta.titulo)
            .setDescription(resposta.texto(CONFIG))
            .setColor(0x00ff00)
            .setFooter({ text: "⚠️ Informação automática — pode não estar 100% atualizada" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ajuda_nova")
                .setLabel("🔄 Nova pergunta")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("ajuda_ticket")
                .setLabel("🎫 Abrir ticket")
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
        return;
    }

    // No FAQ or tutorial match - show not found
    const embed = new EmbedBuilder()
        .setTitle("❓ Não encontrei resultados")
        .setDescription(
            `Não encontrei informações sobre: **"${pergunta}"**

` +
            `**O que podes fazer:**
` +
            `• Reformular a pergunta com palavras-chave (ex: servidor, recrutamento, ETS2LA, mods, VR, Trucky)
` +
            `• Verificar os tutoriais no canal <#${CONFIG.CANAL_REGRAS}>
` +
            `• Abrir um ticket para ajuda personalizada

` +
            `💡 **Dica:** Escreve de forma simples, por exemplo:
` +
            `\`como entrar no servidor\` ou \`como juntar à PAT\``
        )
        .setColor(0xff9800)
        .setFooter({ text: "Powered by PAC Bot 🤖", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ajuda_nova")
            .setLabel("🔄 Nova pergunta")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("ajuda_ticket")
            .setLabel("🎫 Abrir ticket")
            .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}
