terraform {
  required_version = ">= 1.0"

  required_providers {
    yandex = {
      source  = "yandex-cloud/yandex"
      version = "~> 0.100"
    }
  }
}

provider "yandex" {
  zone = "ru-central1-a"
}

locals {
  zones    = ["ru-central1-a", "ru-central1-b", "ru-central1-d"]
  vm_count = 3
}

resource "yandex_vpc_network" "network" {
  name   = "quiz-backend-network"
  labels = {}
}

resource "yandex_vpc_subnet" "subnets" {
  count          = 3
  name           = "quiz-backend-network-subnet-${local.zones[count.index]}"
  zone           = local.zones[count.index]
  network_id     = yandex_vpc_network.network.id
  v4_cidr_blocks = [["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"][count.index]]

  labels = {}
}

resource "yandex_vpc_security_group" "vm_security_group" {
  name        = "quiz-backend-vm-sg"
  description = "Группа безопасности для виртуальных машин quiz-backend"
  network_id  = yandex_vpc_network.network.id

  ingress {
    protocol       = "TCP"
    description    = "HTTP"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 80
  }

  ingress {
    protocol       = "TCP"
    description    = "HTTPS"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 443
  }

  ingress {
    protocol       = "TCP"
    description    = "SSH"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 22
  }

  ingress {
    protocol       = "ANY"
    description    = "Внутренний трафик между машинами"
    v4_cidr_blocks = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  }

  egress {
    protocol       = "ANY"
    description    = "Исходящий трафик"
    v4_cidr_blocks = ["0.0.0.0/0"]
  }

  labels = {}
}

resource "yandex_compute_instance" "vm" {
  count       = local.vm_count
  name        = "quiz-backend-vm-${count.index + 1}"
  platform_id = "standard-v2"
  zone        = local.zones[count.index]

  resources {
    cores  = 2
    memory = 2
  }

  boot_disk {
    initialize_params {
      image_id = var.image_id
      size     = 20
      type     = "network-hdd"
    }
  }

  network_interface {
    subnet_id          = yandex_vpc_subnet.subnets[count.index].id
    nat                = true
    security_group_ids = [yandex_vpc_security_group.vm_security_group.id]
  }

  metadata = {
    ssh-keys  = null
    user-data = <<-EOF
      #cloud-config
      write_files:
        - path: ${var.env_file_path}
          owner: root:root
          permissions: '0600'
          content: |
            ${join("\n            ", [for key, value in var.env_vars : "${key}=${value}"])}
      runcmd:
        - mkdir -p /svr/quiz-backend
        - chmod 777 ${var.env_file_path}
      EOF
  }

  labels = {
    instance_index = count.index + 1
    zone           = local.zones[count.index]
  }
}

resource "yandex_lb_target_group" "target_group" {
  name = "quiz-backend-vm-tg"

  dynamic "target" {
    for_each = yandex_compute_instance.vm
    content {
      subnet_id  = target.value.network_interface[0].subnet_id
      address    = target.value.network_interface[0].ip_address
    }
  }

  labels = {}
}

resource "yandex_lb_network_load_balancer" "load_balancer" {
  name = "quiz-backend-vm-nlb"

  listener {
    name        = "quiz-backend-vm-listener"
    port        = var.lb_listener_port
    target_port = var.lb_backend_port
    protocol    = "tcp"
    external_address_spec {
      ip_version = "ipv4"
    }
  }

  attached_target_group {
    target_group_id = yandex_lb_target_group.target_group.id

    healthcheck {
      name                = "quiz-backend-vm-healthcheck"
      interval            = 10
      timeout             = 5
      healthy_threshold   = 2
      unhealthy_threshold = 2
      http_options {
        port = var.lb_backend_port
        path = "/api/health"
      }
    }
  }
}

