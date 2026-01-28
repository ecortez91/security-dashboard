import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const fixes = {
  // Enable UFW Firewall
  enable_ufw: async () => {
    try {
      await execAsync('sudo ufw --force enable');
      await execAsync('sudo ufw default deny incoming');
      await execAsync('sudo ufw default allow outgoing');
      return { success: true, message: 'UFW enabled with default deny incoming policy' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  // Enable Windows Firewall
  enable_windows_firewall: async () => {
    try {
      await execAsync('powershell.exe -Command "Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True"');
      return { success: true, message: 'Windows Firewall enabled for all profiles' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  // Install security updates
  install_security_updates: async () => {
    try {
      const { stdout } = await execAsync('sudo apt-get upgrade -y --only-upgrade $(apt list --upgradable 2>/dev/null | grep -i security | cut -d/ -f1 | tail -n +2)');
      return { success: true, message: 'Security updates installed', output: stdout };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  // Install all updates
  install_all_updates: async () => {
    try {
      const { stdout } = await execAsync('sudo apt-get upgrade -y');
      return { success: true, message: 'All updates installed', output: stdout };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  // Harden SSH configuration
  harden_ssh: async () => {
    try {
      const hardenedConfig = `
# Security hardening applied by Security Dashboard
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
AllowAgentForwarding no
`;
      
      // Backup current config
      await execAsync('sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup');
      
      // Append hardened settings
      await execAsync(`echo '${hardenedConfig}' | sudo tee -a /etc/ssh/sshd_config`);
      
      // Restart SSH
      await execAsync('sudo systemctl restart sshd || sudo service ssh restart');
      
      return { success: true, message: 'SSH configuration hardened. Backup saved at /etc/ssh/sshd_config.backup' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  // Stop a service
  stop_telnet: async () => {
    try {
      await execAsync('sudo systemctl stop telnet.socket telnetd xinetd 2>/dev/null || true');
      await execAsync('sudo systemctl disable telnet.socket telnetd xinetd 2>/dev/null || true');
      return { success: true, message: 'Telnet services stopped and disabled' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  stop_ftp: async () => {
    try {
      await execAsync('sudo systemctl stop vsftpd proftpd pure-ftpd 2>/dev/null || true');
      await execAsync('sudo systemctl disable vsftpd proftpd pure-ftpd 2>/dev/null || true');
      return { success: true, message: 'FTP services stopped and disabled' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  // Generic permission fix
  fix_permissions: async (params) => {
    if (!params?.path || !params?.mode) {
      return { success: false, message: 'Missing path or mode parameter' };
    }
    
    try {
      await execAsync(`chmod ${params.mode} "${params.path}"`);
      return { success: true, message: `Fixed permissions on ${params.path}` };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },
};
