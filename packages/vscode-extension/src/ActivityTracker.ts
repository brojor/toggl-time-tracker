import type { Heartbeat } from '@toggl-auto-tracker/shared'
import * as vscode from 'vscode'
import { ApiClient } from './ApiClient'
import { ProjectInfoProvider } from './ProjectInfoProvider'

/**
 * Třída pro sledování aktivity uživatele v VS Code editoru
 */
export class ActivityTracker {
  private lastActivity: number = 0
  private disposables: vscode.Disposable[] = []
  private lastSentActivity: number = 0
  private readonly throttleInterval: number = 5000 // 5 sekund
  private currentProjectName?: string
  private apiClient: ApiClient

  constructor() {
    this.lastActivity = Date.now()
    this.lastSentActivity = this.lastActivity
    this.apiClient = new ApiClient()
  }

  /**
   * Spustí sledování aktivity uživatele
   */
  public start(): void {
    console.log('ActivityTracker: Spouštím sledování aktivity')

    // Sledování změn v textu (psaní, mazání)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(() => void this.sendActivity()),
    )

    // Sledování přepínání mezi soubory
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => void this.sendActivity()),
    )

    // Sledování změn výběru textu
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(() => void this.sendActivity()),
    )

    // Sledování přepínání záložek/editorů
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(() => void this.sendActivity()),
    )

    // Sledování scrollování
    this.disposables.push(
      vscode.window.onDidChangeTextEditorVisibleRanges(() => void this.sendActivity()),
    )

    // Sledování změn workspace folderů
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        console.log('ActivityTracker: Změna workspace folderů, aktualizuji informace o projektu')
        await this.updateProjectInfo()

        // Odešleme heartbeat s aktualizovanými informacemi o projektu
        this.sendActivity()
      }),
    )

    // Získáme počáteční informace o projektu
    this.updateProjectInfo()
  }

  /**
   * Odesílá aktivitu uživatele s throttlingem
   */
  private async sendActivity(): Promise<void> {
    try {
      // Vždy aktualizujeme čas poslední aktivity
      this.lastActivity = Date.now()

      // Kontrola, zda uplynul dostatečný čas od posledního odeslání
      const timeSinceLastSent = this.lastActivity - this.lastSentActivity

      if (timeSinceLastSent >= this.throttleInterval) {
        console.log('ActivityTracker: Odesílám aktivitu', {
          time: new Date(this.lastActivity).toISOString(),
          timeSinceLastSent: `${timeSinceLastSent} ms`,
          projectName: this.currentProjectName,
        })

        // Připravíme data pro heartbeat
        const heartbeatData: Heartbeat = {
          timestamp: this.lastActivity,
          source: 'vscode',
          projectName: this.currentProjectName,
        }

        // Aktualizujeme čas posledního odeslání
        this.lastSentActivity = this.lastActivity

        // Odešleme heartbeat na server
        await this.apiClient.sendHeartbeat(heartbeatData)
      }
    }
    catch (error) {
      console.error('ActivityTracker: Chyba při odesílání heartbeatu:', error)
    }
  }

  /**
   * Aktualizuje informace o projektu
   */
  private async updateProjectInfo(): Promise<void> {
    try {
      this.currentProjectName = await ProjectInfoProvider.getProjectName()
    }
    catch (error) {
      console.error('Chyba při získávání informací o projektu:', error)
    }
  }

  /**
   * Zastaví sledování aktivity uživatele
   */
  public dispose(): void {
    console.log('ActivityTracker: Zastavuji sledování aktivity')
    this.disposables.forEach(d => d.dispose())
    this.disposables = []
  }
}
