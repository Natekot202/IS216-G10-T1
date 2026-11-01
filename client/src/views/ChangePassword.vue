<script setup>
import { computed, ref } from 'vue'
import { authApi } from '../services/api.js'
import PasswordInput from '../components/PasswordInput.vue'
import PasswordRules from '../components/PasswordRules.vue'
import { passwordIsValid } from '../utils/passwordChecks.js'

const form = ref({ current: '', next: '', confirm: '' })
const error = ref('')
const done = ref(false)
const saving = ref(false)

const matches = computed(() => form.value.next !== '' && form.value.next === form.value.confirm)

const canSubmit = computed(
  () => !!form.value.current && passwordIsValid(form.value.next) && matches.value && !saving.value
)

async function submit() {
  if (!canSubmit.value) {
    return
  }
  error.value = ''
  done.value = false
  saving.value = true
  try {
    await authApi.changePassword({
      currentPassword: form.value.current,
      newPassword: form.value.next
    })
    done.value = true
    form.value = { current: '', next: '', confirm: '' }
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not change your password.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="cp mx-auto">
    <h3 class="cp-title">Change password</h3>

    <div v-if="done" class="alert alert-success" role="status">
      Your password has been updated.
      <router-link to="/profile" class="alert-link">Back to my profile</router-link>
    </div>
    <div v-if="error" class="alert alert-warning" role="alert">{{ error }}</div>

    <form class="cp-card" @submit.prevent="submit">
      <label for="cp-current" class="form-label">Current password</label>
      <PasswordInput id="cp-current" v-model="form.current" placeholder="Current password"
                     autocomplete="current-password" class="mb-3" />

      <label for="cp-new" class="form-label">New password</label>
      <PasswordInput id="cp-new" v-model="form.next" placeholder="New password"
                     autocomplete="new-password" />

      <PasswordRules :password="form.next" />

      <label for="cp-confirm" class="form-label">Confirm new password</label>
      <PasswordInput id="cp-confirm" v-model="form.confirm" placeholder="Confirm new password"
                     autocomplete="new-password" />
      <p v-if="form.confirm && !matches" class="form-text text-danger mb-0">The two passwords don't match.</p>

      <div class="cp-actions">
        <router-link to="/editProfile" class="btn btn-outline-secondary">Cancel</router-link>
        <button type="submit" class="btn cp-save" :disabled="!canSubmit">
          <span v-if="saving" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
          {{ saving ? 'Updating…' : 'Update password' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.cp {
  max-width: 460px;
  padding: 1rem 0 2rem;
}
.cp-title {
  margin-bottom: 1rem;
  font-weight: 700;
}
.cp-card {
  padding: 1.25rem 1.35rem;
  border: 1px solid rgba(196, 119, 86, 0.3);
  border-top: 4px solid #e6d3c0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 6px 16px rgba(120, 70, 40, 0.1);
}
.cp-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}
.cp-save {
  border: 0;
  background: #a85a38;
  color: #fff;
  font-weight: 600;
}
.cp-save:hover:not(:disabled) {
  background: #8f4a2c;
  color: #fff;
}
</style>