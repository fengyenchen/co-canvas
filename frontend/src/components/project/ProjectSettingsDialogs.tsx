import { useEffect, useRef, useState } from 'react'
import {
  deleteGeminiCredential,
  getGeminiCredential,
  saveGeminiCredential,
  type AiCredential,
} from '../../api/aiCredentials'
import {
  addProjectMember,
  listProjectMembers,
  removeProjectMember,
  updateProject,
  updateProjectMember,
} from '../../api/projects'
import { ApiRequestError } from '../../api/errors'
import type {
  Project,
  ProjectMember,
  ProjectMemberRole,
  ProjectVisibility,
  PublicAccessRole,
} from '../../types/project'

export type ProjectSettingsDialog =
  | 'rename'
  | 'permissions'
  | 'ai'
  | null

type ProjectSettingsDialogsProps = {
  project: Project
  activeDialog: Exclude<ProjectSettingsDialog, null>
  onClose: () => void
  onProjectUpdated: (project: Project) => void
  onAiCredentialUpdated?: () => void
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.detail
  }

  return '操作失敗，請稍後再試。'
}

export function ProjectSettingsDialogs({
  project,
  activeDialog,
  onClose,
  onProjectUpdated,
  onAiCredentialUpdated,
}: ProjectSettingsDialogsProps) {
  const renameDialogRef = useRef<HTMLDialogElement>(null)
  const permissionDialogRef = useRef<HTMLDialogElement>(null)
  const aiSettingsDialogRef = useRef<HTMLDialogElement>(null)
  const initialVisibilityRef = useRef(project.visibility)
  const [name, setName] = useState(project.name)
  const [visibility, setVisibility] =
    useState<ProjectVisibility>(project.visibility)
  const [publicAccessRole, setPublicAccessRole] =
    useState<PublicAccessRole>(project.publicAccessRole)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [memberEmail, setMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] =
    useState<ProjectMemberRole>('viewer')
  const [isLoadingMembers, setIsLoadingMembers] = useState(
    activeDialog === 'permissions' && project.visibility === 'private',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(
    null,
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [aiCredential, setAiCredential] = useState<AiCredential | null>(
    null,
  )
  const [apiKey, setApiKey] = useState('')
  const [isLoadingAiCredential, setIsLoadingAiCredential] =
    useState(activeDialog === 'ai')
  const [isSavingAiCredential, setIsSavingAiCredential] = useState(false)
  const [isRemovingAiCredential, setIsRemovingAiCredential] =
    useState(false)

  useEffect(() => {
    if (activeDialog === 'rename') {
      renameDialogRef.current?.showModal()
      return
    }

    if (activeDialog === 'ai') {
      aiSettingsDialogRef.current?.showModal()

      void getGeminiCredential()
        .then(setAiCredential)
        .catch((error: unknown) => setErrorMessage(getErrorMessage(error)))
        .finally(() => setIsLoadingAiCredential(false))
      return
    }

    permissionDialogRef.current?.showModal()

    if (initialVisibilityRef.current === 'private') {
      void listProjectMembers(project.id)
        .then(setMembers)
        .catch((error: unknown) => setErrorMessage(getErrorMessage(error)))
        .finally(() => setIsLoadingMembers(false))
    }
  }, [activeDialog, project.id])

  async function loadMembers(projectId: string) {
    setIsLoadingMembers(true)
    setErrorMessage(null)

    try {
      setMembers(await listProjectMembers(projectId))
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoadingMembers(false)
    }
  }

  async function handleRename() {
    const nextName = name.trim()

    if (!project || !nextName || isSaving) {
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      onProjectUpdated(await updateProject(project.id, { name: nextName }))
      renameDialogRef.current?.close()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSavePermissions() {
    if (!project || isSaving) {
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      onProjectUpdated(
        await updateProject(project.id, {
          visibility,
          publicAccessRole,
        }),
      )
      permissionDialogRef.current?.close()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddMember() {
    const email = memberEmail.trim().toLowerCase()

    if (!project || !email || isSaving) {
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const member = await addProjectMember(
        project.id,
        email,
        newMemberRole,
      )
      setMembers((current) => [...current, member])
      setMemberEmail('')
      setNewMemberRole('viewer')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdateMember(
    member: ProjectMember,
    role: ProjectMemberRole,
  ) {
    if (!project || updatingMemberId) {
      return
    }

    setUpdatingMemberId(member.id)
    setErrorMessage(null)

    try {
      const updatedMember = await updateProjectMember(
        project.id,
        member.id,
        role,
      )
      setMembers((current) =>
        current.map((item) =>
          item.id === updatedMember.id ? updatedMember : item,
        ),
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setUpdatingMemberId(null)
    }
  }

  async function handleRemoveMember(member: ProjectMember) {
    if (
      !project ||
      updatingMemberId ||
      !window.confirm(`確定要移除 ${member.email} 嗎？`)
    ) {
      return
    }

    setUpdatingMemberId(member.id)
    setErrorMessage(null)

    try {
      await removeProjectMember(project.id, member.id)
      setMembers((current) =>
        current.filter((item) => item.id !== member.id),
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setUpdatingMemberId(null)
    }
  }

  async function handleSaveAiCredential() {
    const normalizedApiKey = apiKey.trim()

    if (!normalizedApiKey || isSavingAiCredential) {
      return
    }

    setIsSavingAiCredential(true)
    setErrorMessage(null)

    try {
      setAiCredential(await saveGeminiCredential(normalizedApiKey))
      setApiKey('')
      onAiCredentialUpdated?.()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSavingAiCredential(false)
    }
  }

  async function handleRemoveAiCredential() {
    if (
      isRemovingAiCredential ||
      !window.confirm('確定要移除 Gemini API Key 嗎？')
    ) {
      return
    }

    setIsRemovingAiCredential(true)
    setErrorMessage(null)

    try {
      await deleteGeminiCredential()
      setAiCredential({
        provider: 'gemini',
        configured: false,
        keyHint: null,
        status: null,
        lastValidatedAt: null,
        updatedAt: null,
        validationResult: null,
      })
      setApiKey('')
      onAiCredentialUpdated?.()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsRemovingAiCredential(false)
    }
  }

  function closeDialog() {
    setErrorMessage(null)
    setApiKey('')
    onClose()
  }

  return (
    <>
      <dialog
        ref={aiSettingsDialogRef}
        aria-labelledby="editor-ai-settings-title"
        aria-describedby="editor-ai-settings-description"
        onClose={closeDialog}
        className="m-auto w-[min(30rem,calc(100%-2rem))] rounded-2xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/20"
      >
        <div className="p-5 sm:p-6">
          <h2
            id="editor-ai-settings-title"
            className="text-xl font-semibold"
          >
            Gemini API Key
          </h2>
          <p
            id="editor-ai-settings-description"
            className="mt-2 text-sm leading-6 text-foreground/60"
          >
            這是你的帳號共用設定，會套用到所有雲端專案。
          </p>

          <div className="mt-5 rounded-xl border border-border bg-canvas/70 p-4">
            {isLoadingAiCredential ? (
              <p role="status" className="text-sm text-foreground/60">
                讀取設定中…
              </p>
            ) : aiCredential?.configured ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    已設定 ••••{aiCredential.keyHint}
                  </p>
                  <p className="mt-1 text-xs text-foreground/55">
                    {aiCredential.validationResult === 'quota_exceeded'
                      ? '額度不足，目前使用 Mock'
                      : aiCredential.validationResult === 'unavailable'
                        ? '暫時無法驗證'
                        : aiCredential.status === 'valid'
                          ? '已驗證'
                          : aiCredential.status === 'invalid'
                            ? '驗證失敗，目前使用 Mock'
                            : '尚未驗證'}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  已設定
                </span>
              </div>
            ) : (
              <p className="text-sm leading-6 text-foreground/60">
                尚未設定，這個雲端專案目前使用 Mock 模式。
              </p>
            )}
          </div>

          <label
            htmlFor="editor-gemini-api-key"
            className="mt-5 block text-sm font-medium"
          >
            {aiCredential?.configured ? '替換 API Key' : 'API Key'}
          </label>
          <input
            id="editor-gemini-api-key"
            type="password"
            value={apiKey}
            autoComplete="off"
            spellCheck={false}
            disabled={isLoadingAiCredential || isSavingAiCredential}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={
              aiCredential?.configured
                ? '輸入新 Key 以替換'
                : '貼上 Gemini API Key'
            }
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none transition placeholder:text-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
          />
          <p className="mt-2 text-xs leading-5 text-foreground/55">
            Key 會加密儲存在後端，設定後不會顯示完整內容。
          </p>

          {errorMessage && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {errorMessage}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {aiCredential?.configured && (
              <button
                type="button"
                disabled={
                  isSavingAiCredential || isRemovingAiCredential
                }
                onClick={() => void handleRemoveAiCredential()}
                className="min-h-11 cursor-pointer rounded-lg border border-red-200 px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50 sm:mr-auto"
              >
                {isRemovingAiCredential ? '移除中…' : '移除 Key'}
              </button>
            )}
            <button
              type="button"
              disabled={
                isSavingAiCredential || isRemovingAiCredential
              }
              onClick={() => aiSettingsDialogRef.current?.close()}
              className="min-h-11 cursor-pointer rounded-lg border border-border px-4 text-sm font-medium transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              關閉
            </button>
            <button
              type="button"
              disabled={
                !apiKey.trim() ||
                isLoadingAiCredential ||
                isSavingAiCredential ||
                isRemovingAiCredential
              }
              onClick={() => void handleSaveAiCredential()}
              className="min-h-11 cursor-pointer rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingAiCredential
                ? '驗證中…'
                : aiCredential?.configured
                  ? '替換 Key'
                  : '儲存 Key'}
            </button>
          </div>
        </div>
      </dialog>

      <dialog
        ref={renameDialogRef}
        aria-labelledby="editor-rename-project-title"
        onClose={closeDialog}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/20"
      >
        <form
          className="p-6"
          onSubmit={(event) => {
            event.preventDefault()
            void handleRename()
          }}
        >
          <h2 id="editor-rename-project-title" className="text-xl font-semibold">
            重新命名專案
          </h2>
          <label htmlFor="editor-project-name" className="mt-5 block text-sm font-medium">
            專案名稱
          </label>
          <input
            id="editor-project-name"
            autoFocus
            required
            maxLength={120}
            value={name}
            disabled={isSaving}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
          />
          {errorMessage && <p role="alert" className="mt-3 text-sm text-red-600">{errorMessage}</p>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={isSaving} onClick={() => renameDialogRef.current?.close()} className="min-h-11 cursor-pointer rounded-lg border border-border px-4 text-sm font-medium transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50">
              取消
            </button>
            <button type="submit" disabled={!name.trim() || isSaving} className="min-h-11 cursor-pointer rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
              {isSaving ? '儲存中…' : '儲存名稱'}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={permissionDialogRef}
        aria-labelledby="editor-permission-title"
        onClose={closeDialog}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/20"
      >
        <div className="p-5 sm:p-6">
          <h2 id="editor-permission-title" className="text-xl font-semibold">權限管理</h2>
          <p className="mt-2 text-sm leading-6 text-foreground/60">設定誰能開啟「{project?.name}」及其操作權限。</p>

          <fieldset className="mt-6">
            <legend className="text-sm font-medium">專案可見範圍</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(['private', 'public'] as const).map((value) => (
                <label key={value} className="flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:disabled]:cursor-not-allowed">
                  <input
                    type="radio"
                    name="editor-project-visibility"
                    value={value}
                    checked={visibility === value}
                    disabled={isSaving}
                    onChange={() => {
                      setVisibility(value)
                      if (value === 'private' && project && members.length === 0) void loadMembers(project.id)
                    }}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium">{value === 'private' ? '私人' : '公開'}</span>
                    <span className="mt-1 block text-xs leading-5 text-foreground/55">{value === 'private' ? '只有專案成員可以開啟' : '任何取得連結的人都能開啟'}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {visibility === 'public' ? (
            <fieldset className="mt-6 border-t border-border pt-6">
              <legend className="text-sm font-medium">公開訪客權限</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(['viewer', 'editor'] as const).map((role) => (
                  <label key={role} className="flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:disabled]:cursor-not-allowed">
                    <input type="radio" name="editor-public-role" checked={publicAccessRole === role} disabled={isSaving} onChange={() => setPublicAccessRole(role)} className="mt-1 size-4 accent-primary" />
                    <span>
                      <span className="block text-sm font-medium">{role === 'viewer' ? '可以檢視' : '可以編輯'}</span>
                      <span className="mt-1 block text-xs leading-5 text-foreground/55">{role === 'viewer' ? '能查看畫布，但不能修改' : '能修改畫布與對話'}</span>
                    </span>
                  </label>
                ))}
              </div>
              {publicAccessRole === 'editor' && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">任何取得連結的人都能修改內容。</p>}
            </fieldset>
          ) : (
            <section className="mt-6 border-t border-border pt-6" aria-labelledby="editor-members-title">
              <h3 id="editor-members-title" className="text-sm font-medium">專案成員</h3>
              <div className="mt-3 rounded-xl border border-border bg-canvas px-4 py-3 text-sm">
                你 <span className="ml-2 text-xs text-foreground/55">擁有者</span>
              </div>
              <form className="mt-4 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); void handleAddMember() }}>
                <label>
                  <span className="mb-1 block text-xs font-medium text-foreground/65">成員 Email</span>
                  <input type="email" required maxLength={320} value={memberEmail} disabled={isSaving} onChange={(event) => setMemberEmail(event.target.value)} placeholder="name@example.com" className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-foreground/65">角色</span>
                  <select value={newMemberRole} disabled={isSaving} onChange={(event) => setNewMemberRole(event.target.value as ProjectMemberRole)} className="min-h-11 w-full cursor-pointer rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed">
                    <option value="viewer">檢視者</option>
                    <option value="editor">編輯者</option>
                  </select>
                </label>
                <button type="submit" disabled={!memberEmail.trim() || isSaving} className="min-h-11 cursor-pointer rounded-lg border border-border px-4 text-sm font-medium transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40">加入</button>
              </form>
              {isLoadingMembers ? (
                <p role="status" className="mt-4 text-sm text-foreground/55">正在載入成員…</p>
              ) : members.length === 0 ? (
                <p className="mt-4 text-sm text-foreground/50">尚未加入其他成員。</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {members.map((member) => (
                    <li key={member.id} className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center">
                      <span title={member.email} className="min-w-0 flex-1 truncate text-sm">{member.email}</span>
                      <select aria-label={`設定 ${member.email} 的角色`} value={member.role} disabled={updatingMemberId !== null} onChange={(event) => void handleUpdateMember(member, event.target.value as ProjectMemberRole)} className="min-h-11 cursor-pointer rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed">
                        <option value="viewer">檢視者</option>
                        <option value="editor">編輯者</option>
                      </select>
                      <button type="button" disabled={updatingMemberId !== null} onClick={() => void handleRemoveMember(member)} className="min-h-11 cursor-pointer rounded-lg px-3 text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">{updatingMemberId === member.id ? '處理中…' : '移除'}</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {errorMessage && <p role="alert" className="mt-4 text-sm text-red-600">{errorMessage}</p>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={isSaving} onClick={() => permissionDialogRef.current?.close()} className="min-h-11 cursor-pointer rounded-lg border border-border px-4 text-sm font-medium transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50">取消</button>
            <button type="button" disabled={isSaving} onClick={() => void handleSavePermissions()} className="min-h-11 cursor-pointer rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? '儲存中…' : '儲存權限'}</button>
          </div>
        </div>
      </dialog>
    </>
  )
}
